.PHONY: help venv-setup dev-up dev-down prod-up prod-down backend-cli backend-test dev-logs shell frontend-test backend-unit-test test-all

# --- High Level Commands ---
start: venv-setup prod-up
	@echo "Opening Portfolio Lab in your browser..."
	@sleep 5 && (open http://localhost:3000 || xdg-open http://localhost:3000 || echo "Please open http://localhost:3000 manually.")

portfolio-lab:
	@:

close: dev-down prod-down
	@echo "All environments have been shut down."

# --- Variables ---
VENV = .venv
PYTHON = $(VENV)/bin/python3
PIP = $(VENV)/bin/pip
DB_URL_DEV = postgresql://postgres:postgres@localhost:5433/portfolio_lab

# --- Default ---
all: help

# --- Help ---
help:
	@echo "Portfolio Lab - Project Management Commands"
	@echo "-------------------------------------------"
	@echo "Quick Start:"
	@echo "  make start        : The 'magic' command. Sets up everything and opens the browser"
	@echo "  make close        : Stop everything (dev and prod)"
	@echo ""
	@echo "Environment:"
	@echo "  make venv-setup   : Create/update virtual environment and install dependencies"
	@echo "  make shell        : Start a new shell session with virtual environment activated"
	@echo ""
	@echo "Development (Docker):"
	@echo "  make dev-up       : Start development containers (Backend, Frontend, DB)"
	@echo "  make dev-down     : Stop and remove development containers"
	@echo "  make dev-logs     : Follow development container logs"
	@echo ""
	@echo "Production (Docker):"
	@echo "  make prod-up      : Start production containers"
	@echo "  make prod-down    : Stop and remove production containers"
	@echo ""
	@echo "Backend Tools:"
	@echo "  make backend-cli  : Run the interactive Python CLI tool"
	@echo "  make backend-test : Run backend integration tests"
	@echo "  make backend-unit-test : Run backend unit tests"
	@echo "  make frontend-test : Run frontend Jest tests"
	@echo "  make test-all : Run backend unit + integration + frontend tests"
	@echo ""
	@echo "Manual Activation: source $(VENV)/bin/activate"

# --- Setup ---
venv-setup:
	@echo "Setting up virtual environment in $(VENV)..."
	@test -d $(VENV) || python3 -m venv $(VENV)
	@$(PIP) install --upgrade pip
	@$(PIP) install -r backend/requirements.txt
	@echo "\n✅ Virtual environment is ready."
	@echo "Run 'make shell' to enter the environment or 'source $(VENV)/bin/activate' manually."

# --- Development ---
dev-up:
	@echo "Launching development environment..."
	@./scripts/ops/dev_up.sh

dev-start: dev-up

dev-down:
	@echo "Stopping development environment..."
	@./scripts/ops/dev_down.sh

dev-stop: dev-down

dev-logs:
	@docker-compose -f docker-compose.dev.yml logs -f

# --- Production ---
prod-up:
	@echo "Launching production environment..."
	@./scripts/ops/prod_up.sh

prod-start: prod-up

prod-down:
	@echo "Stopping production environment..."
	@./scripts/ops/prod_down.sh

prod-stop: prod-down

# --- Backend Operations ---
backend-cli:
	@echo "Starting Backend CLI..."
	@export PYTHONPATH=$${PYTHONPATH}:$(shell pwd) && \
	 export DATABASE_URL=$(DB_URL_DEV) && \
	 $(PYTHON) backend/cli.py

backend-test:
	@echo "Running Integration Tests..."
	@docker-compose -f docker-compose.dev.yml build backend
	@docker-compose -f docker-compose.dev.yml run --rm \
	 -e BACKEND_URL=http://backend:8000/api/v1/health \
	 -e FRONTEND_URL=http://frontend:3000 \
	 backend python tests/integration/test_infrastructure.py

backend-unit-test:
	@echo "Running Backend Unit Tests..."
	@docker-compose -f docker-compose.dev.yml build backend
	@docker-compose -f docker-compose.dev.yml run --rm backend pytest tests/unit

frontend-test:
	@echo "Running Frontend Jest Tests..."
	@docker-compose -f docker-compose.dev.yml run --rm frontend sh -c "npm ci && npm test"

test-all: frontend-test backend-unit-test backend-test

# --- Interactive Shell ---
shell:
	@echo "Entering subshell with environment activated. Type 'exit' to return."
	@zsh -c "source $(VENV)/bin/activate; exec zsh -i" || \
	 bash -c "source $(VENV)/bin/activate; exec bash -i" || \
	 ( . $(VENV)/bin/activate && $(SHELL) -i )
