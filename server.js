const Y = require('yjs')
const syncProtocol = require('y-protocols/sync')
const awarenessProtocol = require('y-protocols/awareness')
const encoding = require('lib0/encoding')
const decoding = require('lib0/decoding')
const {WebSocket} = require('ws')

const {pub, sub} = require('./pubsub')
const {getDocUpdatesFromQueue, pushDocUpdatesToQueue} = require('./redis')
const knex = require('./knex.js')

const gcEnabled = process.env.GC !== 'false' && process.env.GC !== '0'

const docs = new Map()

const messageSync = 0
const messageAwareness = 1
const pingTimeout = 30000

const wsReadyStateConnecting = 0
const wsReadyStateOpen = 1

const updatesLimit = 50

const cleanup = () => {
  docs.forEach(doc => {
    doc.conns.forEach((_, conn) => {
      closeConn(doc, conn)
    })
  })
}

const closeConn = (doc, conn) => {
  const controlledIds = doc.conns.get(conn)
  if (controlledIds) {
    doc.conns.delete(conn)
    awarenessProtocol.removeAwarenessStates(doc.awareness, Array.from(controlledIds), null)

    if (doc.conns.size === 0) {
      doc.destroy()
      docs.delete(doc.name)
    }
  }
  conn.close()
}

const getUpdates = async (doc) => {
  const updates = await knex('items').where('docname', doc.name).orderBy('id')

  if (updates.length >= updatesLimit) {
    const dbYDoc = new Y.Doc()

    dbYDoc.transact(() => {
      for (const u of updates) {
        Y.applyUpdate(dbYDoc, u.update)
      }
    })

    const [mergedUpdates] = await Promise.all([
      knex('items').insert({docname: doc.name, update: Y.encodeStateAsUpdate(dbYDoc)}).returning('*'),
      knex('items').where('docname', doc.name).whereIn('id', updates.map(({id}) => id)).delete()
    ])

    return mergedUpdates
  } else {
    return updates
  }
}

const bindState = async (doc) => {
  const persistedUpdates = await getUpdates(doc)
  const dbYDoc = new Y.Doc()

  dbYDoc.transact(() => {
    for (const u of persistedUpdates) {
      Y.applyUpdate(dbYDoc, u.update)
    }
  })

  Y.applyUpdate(doc, Y.encodeStateAsUpdate(dbYDoc))

  const redisUpdates = await getDocUpdatesFromQueue(doc)
  const redisYDoc = new Y.Doc()
  redisYDoc.transact(() => {
    for (const u of redisUpdates) {
      Y.applyUpdate(redisYDoc, u)
    }
  })

  Y.applyUpdate(doc, Y.encodeStateAsUpdate(redisYDoc))
}

const getYDoc = (docname, gc = true) => {
  const existing = docs.get(docname)
  if (existing) {
    return [existing, false]
  }

  const doc = new WSSharedDoc(docname)
  doc.gc = gc

  docs.set(docname, doc)

  return [doc, true]
}


const messageListener = async (conn, doc, message) => {
  try {
    const encoder = encoding.createEncoder()
    const decoder = decoding.createDecoder(message)
    const messageType = decoding.readVarUint(decoder)

    switch (messageType) {
    case messageSync: {
      encoding.writeVarUint(encoder, messageSync)
      syncProtocol.readSyncMessage(decoder, encoder, doc, conn)

      if (encoding.length(encoder) > 1) {
        send(doc, conn, encoding.toUint8Array(encoder))
      }

      break
    }
    case messageAwareness: {
      const update = decoding.readVarUint8Array(decoder)
      pub.publish(doc.awarenessChannel, Buffer.from(update))
      awarenessProtocol.applyAwarenessUpdate(doc.awareness, update, conn)
      break
    }
    }
  } catch (err) {
    console.error(err)
    doc.emit('error', [err])
  }
}

const persistUpdate = async (doc, update) => {
  await knex('items').insert({docname: doc.name, update})
}

const propagateUpdate = (doc, update) => {
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, messageSync)
  syncProtocol.writeUpdate(encoder, update)
  const message = encoding.toUint8Array(encoder)
  doc.conns.forEach((_, conn) => {
    send(doc, conn, message)
  })
}

const send = (doc, conn, m) => {
  if (conn.readyState !== wsReadyStateConnecting && conn.readyState !== wsReadyStateOpen) {
    closeConn(doc, conn)
  }

  try {
    conn.send(m, err => {
      if (err) {
        console.error('err while send', err)
        closeConn(doc, conn)
      }
    })
  } catch (e) {
    console.error('catched error during "send"', e)
    closeConn(doc, conn)
  }
}

const setupWSConnection = async (conn, req, {docName = req.url.slice(1).split('?')[0], gc = true} = {}) => {
  conn.binaryType = 'arraybuffer'

  let isDocLoaded = false
  let queuedMessages = []
  let isConnectionAlive = true

  const [doc, isNew] = getYDoc(docName, gc)
  doc.conns.set(conn, new Set())

  const sendSyncStep1 = () => {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, messageSync)
    syncProtocol.writeSyncStep1(encoder, doc)
    send(doc, conn, encoding.toUint8Array(encoder))
    const awarenessStates = doc.awareness.getStates()
    if (awarenessStates.size > 0) {
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, messageAwareness)
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(doc.awareness, Array.from(awarenessStates.keys())))
      send(doc, conn, encoding.toUint8Array(encoder))
    }
  }

  if (isNew) {
    bindState(doc)
      .then(() => {
        if (!isConnectionAlive) {
          return
        }

        isDocLoaded = true
        queuedMessages.forEach(message => messageListener(conn, doc, message))
        queuedMessages = []
        sendSyncStep1()
      })
  } else {
    isDocLoaded = true
    sendSyncStep1()
  }

  conn.on('message', (message) => {
    if (isDocLoaded) {
      messageListener(conn, doc, new Uint8Array(message))
    } else {
      queuedMessages.push(new Uint8Array(message))
    }
  })

  let pongReceived = true
  const pingInterval = setInterval(() => {
    if (!pongReceived) {
      if (doc.conns.has(conn)) {
        closeConn(doc, conn)
        isConnectionAlive = false
      }
      clearInterval(pingInterval)
    } else if (doc.conns.has(conn)) {
      pongReceived = false
      try {
        conn.ping()
      } catch (e) {
        closeConn(doc, conn)
        isConnectionAlive = false
        clearInterval(pingInterval)
      }
    }
  }, pingTimeout)

  conn.on('close', () => {
    closeConn(doc, conn)
    isConnectionAlive = false
    clearInterval(pingInterval)
  })

  conn.on('pong', () => {
    pongReceived = true
  })
}

const updateHandler = (update, origin, doc) => {
  let isOriginWSConn = origin instanceof WebSocket && doc.conns.has(origin)

  if (isOriginWSConn) {
    Promise.all([
      pub.publish(doc.name, Buffer.from(update)),
      pushDocUpdatesToQueue(doc, update)
    ])

    propagateUpdate(doc, update)

    persistUpdate(doc, update)
      .catch((err) => {
        console.error(err)
        closeConn(doc, origin)
      })
  } else {
    propagateUpdate(doc, update)
  }
}

class WSSharedDoc extends Y.Doc {
  constructor(name) {
    super({gc: gcEnabled})
    this.name = name
    this.conns = new Map()
    this.awareness = new awarenessProtocol.Awareness(this)
    this.awarenessChannel = `${name}-awareness`

    const awarenessChangeHandler = ({added, updated, removed}, origin) => {
      const changedClients = added.concat(updated, removed)
      if (origin !== null) {
        const connControlledIds = this.conns.get(origin)
        if (connControlledIds) {
          added.forEach(clientId => {
            connControlledIds.add(clientId)
          })
          removed.forEach(clientId => {
            connControlledIds.delete(clientId)
          })
        }
      }

      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, messageAwareness)
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients))
      const buff = encoding.toUint8Array(encoder)

      this.conns.forEach((_, c) => {
        send(this, c, buff)
      })
    }

    this.awareness.on('update', awarenessChangeHandler)
    this.on('update', updateHandler)

    this.subscribe()
  }

  subscribe() {
    sub.subscribe([this.name, this.awarenessChannel]).then(() => {
      sub.on('messageBuffer', (channel, update) => {
        const channelId = channel.toString()

        if (channelId === this.name) {
          Y.applyUpdate(this, update, sub)
        } else if (channelId === this.awarenessChannel) {
          awarenessProtocol.applyAwarenessUpdate(this.awareness, update, sub)
        }
      })
    })
  }

  destroy() {
    super.destroy()
    sub.removeAllListeners()
    sub.unsubscribe(this.awarenessChannel)
    sub.unsubscribe(this.name)
  }
}

exports.cleanup = cleanup
exports.setupWSConnection = setupWSConnection