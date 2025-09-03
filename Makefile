# Nubia Development Makefile
.PHONY: help install dev build test clean docker-up docker-down docker-build setup

# Default target
help:
	@echo "Nubia - Excel Automation Chatbot"
	@echo ""
	@echo "Available commands:"
	@echo "  make setup      - Complete project setup"
	@echo "  make install    - Install all dependencies"
	@echo "  make dev        - Start development servers"
	@echo "  make build      - Build all services"
	@echo "  make test       - Run tests"
	@echo "  make lint       - Run linters"
	@echo "  make clean      - Clean build artifacts"
	@echo "  make docker-up  - Start Docker services"
	@echo "  make docker-down - Stop Docker services"
	@echo "  make docker-build - Build Docker images"
	@echo "  make migrate    - Run database migrations"

# Environment setup
setup: .env install docker-up migrate
	@echo "✅ Setup complete!"

.env:
	@echo "Creating .env file from .env.example..."
	@cp .env.example .env
	@echo "⚠️  Please edit .env file with your configuration"

# Dependencies
install:
	@echo "Installing dependencies..."
	@npm install
	@cd desktop && npm install
	@cd backend && npm install
	@cd automation && pip install -r requirements.txt
	@cd shared && npm install

# Development
dev:
	@echo "Starting development servers..."
	@npm run dev

dev-desktop:
	@echo "Starting desktop app..."
	@npm run dev:desktop

dev-backend:
	@echo "Starting backend server..."
	@npm run dev:backend

dev-automation:
	@echo "Starting automation service..."
	@npm run dev:automation

# Building
build:
	@echo "Building all services..."
	@npm run build

build-desktop:
	@cd desktop && npm run build

build-backend:
	@cd backend && npm run build

build-shared:
	@cd shared && npm run build

# Testing
test:
	@echo "Running tests..."
	@npm run test

lint:
	@echo "Running linters..."
	@npm run lint

type-check:
	@echo "Running type checks..."
	@npm run type-check

# Database
migrate:
	@echo "Running database migrations..."
	@npm run db:migrate

db-reset:
	@echo "Resetting database..."
	@cd backend && npx prisma migrate reset --force

db-studio:
	@echo "Opening Prisma Studio..."
	@cd backend && npx prisma studio

# Docker operations
docker-up:
	@echo "Starting Docker services..."
	@docker-compose up -d

docker-up-dev:
	@echo "Starting development Docker services..."
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

docker-down:
	@echo "Stopping Docker services..."
	@docker-compose down

docker-build:
	@echo "Building Docker images..."
	@docker-compose build

docker-logs:
	@docker-compose logs -f

docker-logs-backend:
	@docker-compose logs -f backend

docker-logs-automation:
	@docker-compose logs -f automation

# Cleaning
clean:
	@echo "Cleaning build artifacts..."
	@rm -rf desktop/dist desktop/build
	@rm -rf backend/dist
	@rm -rf shared/dist
	@rm -rf automation/__pycache__ automation/logs/*.log
	@npm run clean --workspaces --if-present

clean-docker:
	@echo "Cleaning Docker resources..."
	@docker-compose down -v
	@docker system prune -f

# Production deployment
deploy-build:
	@echo "Building for production..."
	@NODE_ENV=production npm run build
	@docker-compose build

deploy-up:
	@echo "Starting production services..."
	@docker-compose -f docker-compose.yml --profile production up -d

# Utility commands
logs:
	@tail -f backend/logs/*.log automation/logs/*.log

ps:
	@docker-compose ps

restart:
	@docker-compose restart

health:
	@curl -f http://localhost:3001/health && echo " ✅ Backend healthy"
	@curl -f http://localhost:8000/health && echo " ✅ Automation healthy"

# Package management
update:
	@echo "Updating dependencies..."
	@npm update
	@npm update --workspaces

audit:
	@echo "Running security audit..."
	@npm audit
	@npm audit --workspaces