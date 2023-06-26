const config = {
  httpServer: {
    host: process.env.HOST ?? 'localhost',
    port: process.env.PORT ?? 9000
  },
  redis: {
    protocol: process.env.REDIS_PROTOCOL ?? 'redis',
    host: process.env.REDIS_HOST ?? 'localhost',
    port: process.env.REDIS_PORT ?? 6379
  },
  postgres: {
    development: {
      client: 'postgresql',
      connection: {
        host: process.env.POSTGRES_HOST ?? 'localhost',
        port: process.env.POSTGRES_PORT ?? 15432,
        database: process.env.POSTGRES_DATABASE ?? 'app',
        user:     process.env.POSTGRES_USER ?? 'postgres',
        password: process.env.POSTGRES_PASSWORD ?? ''
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
