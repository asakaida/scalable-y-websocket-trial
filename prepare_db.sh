#!/usr/bin/env sh

docker-compose exec postgres createdb -h postgres -U postgres app
