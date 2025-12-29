.PHONY: dev prod stop clean logs test venv cli help list

# Variables
VENV = .venv
PYTHON = $(VENV)/bin/python3
PIP = $(VENV)/bin/pip

# Default target
all: help

# List all commands
list: help

# Help message
help:
	@echo "Available commands:"
	@echo "  make venv    : Setup/Update virtual environment"
	@echo "  make shell   : Open a new shell with venv activated"
	@echo "  make dev     : Start development environment (Docker)"
	@echo "  make stop    : Stop development environment"
	@echo "  make prod    : Start production environment"
	@echo "  make clean   : Stop production environment"
	@echo "  make cli     : Run interactive CLI tool"
	@echo "  make test    : Run integration tests"
	@echo "  make logs    : View development logs"
	@echo "  make list    : List all available commands"
	@echo "  make activate: Show command to activate venv"
	@echo ""
	@echo "To activate venv manually: source .venv/bin/activate"

# Environment
venv:
	@test -d $(VENV) || python3 -m venv $(VENV)
	@$(PIP) install --upgrade pip
	@$(PIP) install -r backend/requirements.txt
	@echo "Venv updated. Source it with: source $(VENV)/bin/activate"

activate:
	@echo "Run this command to activate the virtual environment:"
	@echo "source $(VENV)/bin/activate"

shell:
	@echo "Entering shell with venv activated (type 'exit' to leave)..."
	@bash --rcfile <(echo "source ~/.bashrc; source $(VENV)/bin/activate") || \
	 zsh -c "source $(VENV)/bin/activate; exec zsh" || \
	 $(SHELL)

# Development
dev:
	@./scripts/ops/dev_up.sh

stop:
	@./scripts/ops/dev_down.sh

# Production
prod:
	@./scripts/ops/prod_up.sh

clean:
	@./scripts/ops/prod_down.sh

# CLI Tool
cli:
	@export PYTHONPATH=$(PYTHONPATH):$(shell pwd) && $(PYTHON) backend/cli.py

# Utilities
logs:
	@docker-compose -f docker-compose.dev.yml logs -f

test:
	@$(PYTHON) tests/integration/test_infrastructure.py
