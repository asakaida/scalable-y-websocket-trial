FROM node:slim

ENV HOST 0.0.0.0
ENV PORT 9000
ENV REDIS_PROTOCOL redis
ENV REDIS_HOST localhost
ENV REDIS_PORT 6379
ENV POSTGRES_HOST localhost
ENV POSTGRES_PORT 5432
ENV POSTGRES_DATABASE app
ENV POSTGRES_USER postgres
ENV POSTGRES_PASSWORD ''

ADD . .
RUN npm install
CMD ["npm", "run", "start"]
