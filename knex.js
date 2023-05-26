const environment = 'development'

const config = require('./config')
const knex = require('knex')(config.postgres[environment])

module.exports = knex