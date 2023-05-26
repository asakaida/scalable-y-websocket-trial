const config = {
  httpServer: {
    host: 'localhost',
    port: 9000
  },
  redis: {
    host: 'localhost',
    port: 6379
  },
  postgres: {
    development: {
      client: 'postgresql',
      connection: {
        host: 'localhost',
        port: 15432,
        database: 'app',
        user:     'postgres',
        password: ''
      },
      pool: {
        min: 2,
        max: 10
      }
    },

    staging: {
      client: 'postgresql',
      connection: {
        database: 'my_db',
        user:     'username',
        password: 'password'
      },
      pool: {
        min: 2,
        max: 10
      }
    },

    production: {
      client: 'postgresql',
      connection: {
        database: 'my_db',
        user:     'username',
        password: 'password'
      },
      pool: {
        min: 2,
        max: 10
      }
    }
  }
}

module.exports = config
