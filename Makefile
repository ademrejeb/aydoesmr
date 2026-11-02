.PHONY: help up down logs ps db-shell db-migrate db-seed db-studio build test lint fmt fmt-fix clean web-dev api-dev graphify

help:
	@echo "TechVerse"
	@echo ""
	@echo "  make up          Start postgres, pgAdmin, redis, api, websocket, gateway, web"
	@echo "  make down        Stop the stack (volumes are kept)"
	@echo "  make logs        Follow docker compose logs"
	@echo "  make db-migrate  Apply Prisma migrations to the local database"
	@echo "  make db-seed     Seed demo data"
	@echo "  make db-studio   Open Prisma Studio"
	@echo "  make web-dev     Run the Next.js dashboard on :3000"
	@echo "  make api-dev     Run the NestJS API on :3001"
	@echo "  make build       Build the Rust workspace"
	@echo "  make test        Run the Rust test suite"
	@echo "  make lint        Run clippy and rustfmt checks"
	@echo "  make graphify    Build a local code knowledge graph"
	@echo ""
	@echo "  pgAdmin: http://localhost:5050  (admin@techverse.dev / admin)"

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f

ps:
	docker compose ps

db-shell:
	docker compose exec postgres psql -U techverse -d techverse

db-migrate:
	docker compose exec -T api npx prisma migrate deploy

db-seed:
	docker compose exec -T api npx prisma db seed

db-studio:
	npm --prefix services/api run prisma:studio

build:
	cargo build --workspace

release:
	cargo build --workspace --release

test:
	cargo test --workspace

lint:
	cargo fmt --all -- --check
	cargo clippy --workspace -- -D warnings

fmt:
	cargo fmt --all -- --check

fmt-fix:
	cargo fmt --all

clean:
	cargo clean

web-dev:
	npm --prefix techdebt-platform run dev

api-dev:
	npm --prefix services/api run start:dev

# Code-only: local AST, no LLM key needed. Add docs/images with
# `python -m graphify . --no-viz` plus an API key.
graphify:
	python -m graphify . --no-viz --code-only
