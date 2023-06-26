const config = require('./config')
const Redis = require('ioredis')

exports.pub = new Redis(`${config.redis.protocol}://${config.redis.host}:${config.redis.port}`);
exports.sub = new Redis(`${config.redis.protocol}://${config.redis.host}:${config.redis.port}`);
