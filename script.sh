#!/usr/bin/env sh
set -eu

case "${1:-}" in
  build)
    docker compose build
    ;;
  migrate)
    docker compose run --rm backend python manage.py migrate
    ;;
  run)
    docker compose up
    ;;
  *)
    echo "Usage: ./script.sh {build|migrate|run}"
    exit 1
    ;;
esac
