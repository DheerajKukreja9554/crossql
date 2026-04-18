.PHONY: dev backend frontend test test-backend test-frontend test-e2e lint db-up db-down

# Start both backend and frontend dev servers
dev:
	@echo "Starting backend and frontend..."
	@make -j2 backend frontend

backend:
	cd backend && uv run uvicorn main:app --reload --port 8000

frontend:
	cd frontend && npm run dev

# Database
db-up:
	docker-compose up -d
	@echo "Waiting for DBs to be ready..."
	@sleep 3

db-down:
	docker-compose down

# Tests
test: test-backend test-frontend

test-backend:
	cd backend && uv run pytest tests/ -v

test-frontend:
	cd frontend && npm run test

test-e2e:
	cd e2e && npx playwright test

# Lint
lint:
	cd backend && uv run ruff check . && uv run ruff format --check .
	cd frontend && npm run lint

# Setup
install:
	cd backend && uv sync
	cd frontend && npm install
	cd e2e && npm install
