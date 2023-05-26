const config = require('./config')
const Redis = require('ioredis')

const redis = new Redis(config.redis)

const getDocUpdatesKey = (doc) => {
  `doc:${doc.name}:updates`
}

const getDocUpdatesFromQueue = async (doc) => {
  return redis.lrangeBuffer(getDocUpdatesKey(doc), 0, -1)
}
exports.getDocUpdatesFromQueue = getDocUpdatesFromQueue

const pushDocUpdatesToQueue = async (doc, update) => {
  const len = await redis.llen(getDocUpdatesKey(doc))
  if (len > 100) {
    await redis.pipeline()
      .lpopBuffer(getDocUpdatesKey(doc))
      .rpush(getDocUpdatesKey(doc), Buffer.from(update))
      .expire(getDocUpdatesKey(doc), 300)
      .exec()
  } else {
    await redis.pipeline()
      .rpush(getDocUpdatesKey(doc), Buffer.from(update))
      .expire(getDocUpdatesKey(doc), 300)
      .exec()
  }
}

exports.pushDocUpdatesToQueue = pushDocUpdatesToQueue