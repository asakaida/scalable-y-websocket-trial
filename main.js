const config = require('./config')
const express = require('express')
const {WebSocketServer} = require('ws')
const http = require('http')

const {cleanup, setupWSConnection} = require('./server')

const app = express()
const httpServer = http.createServer(app)
const wss = new WebSocketServer({noServer: true})

wss.on('connection', async(ws, req) => {
  await setupWSConnection(ws, req)
})

httpServer.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req)
  })
})

app.get('/healthcheck', (req, res) => res.send('ok: asakaida/scalable-y-websocket-trial'));

const run = async () => {
  await new Promise(resolve => {
    httpServer.listen(config.httpServer.port, config.httpServer.host, () => {
      resolve()
    })
  })

  return async () => {
    cleanup()

    await new Promise(resolve => {
      wss.close(() => {
        resolve()
      })
    })

    await new Promise(resolve => {
      httpServer.close(() => {
        resolve()
      })
    })
  }
}

run()
  .then(() => {
    console.log(`HTTP server started at ${config.httpServer.host}:${config.httpServer.port}`)
  }).catch((e) => {
    console.log(`HTTP server failed: ${e}`)
  })
