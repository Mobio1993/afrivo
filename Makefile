.PHONY: build migrate run

build:
	docker compose build

migrate:
	docker compose run --rm backend python manage.py migrate

run:
	docker compose up
