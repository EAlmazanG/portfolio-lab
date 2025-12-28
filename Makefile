.PHONY: dev prod stop clean logs test

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

# Utilities
logs:
	@docker-compose -f docker-compose.dev.yml logs -f

test:
	@python3 tests/integration/test_infrastructure.py

