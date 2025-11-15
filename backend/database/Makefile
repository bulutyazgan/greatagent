.PHONY: help install dev run db-up db-down db-reset db-shell test clean

help:
	@echo "Available commands:"
	@echo "  make install    - Install dependencies"
	@echo "  make dev        - Install dev dependencies"
	@echo "  make run        - Run the API server"
	@echo "  make db-up      - Start PostgreSQL with Docker"
	@echo "  make db-down    - Stop PostgreSQL"
	@echo "  make db-reset   - Reset database (drop and recreate)"
	@echo "  make db-shell   - Open PostgreSQL shell"
	@echo "  make test       - Run tests"
	@echo "  make clean      - Clean Python cache files"

install:
	pip install -r requirements.txt

dev:
	pip install -r requirements.txt
	pip install pytest pytest-asyncio httpx

run:
	python run.py

db-up:
	docker-compose up -d
	@echo "Waiting for database to be ready..."
	@sleep 3
	@echo "Database is ready!"

db-down:
	docker-compose down

db-reset:
	docker-compose down -v
	docker-compose up -d
	@echo "Waiting for database to initialize..."
	@sleep 3
	@echo "Database reset complete!"

db-shell:
	docker-compose exec postgres psql -U beacon_user -d beacon

test:
	pytest -v

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	find . -type f -name "*.pyd" -delete
