const config = require('./config')
const Redis = require('ioredis')

exports.pub = new Redis(config.redis)
exports.sub = new Redis(config.redis)
