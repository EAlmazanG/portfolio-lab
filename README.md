# Portfolio-Lab

**Portfolio-Lab** is a full-stack simulation and backtesting platform designed to challenge the traditional "blind" Dollar Cost Averaging (DCA) strategy.

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Python 3.13+ (optional, for local tools)
- Node.js 20+ (optional, for local frontend)

### Development Environment

1. **Start the environment:**
   ```bash
   ./scripts/ops/dev_up.sh
   ```
   This command builds the Docker containers and starts the services in development mode with hot-reloading.
   
   - **Backend API:** [http://localhost:8000/docs](http://localhost:8000/docs)
   - **Frontend:** [http://localhost:3001](http://localhost:3001)
   - **Database:** `localhost:5432`

3. **Manage Data (CLI):**
   ```bash
   make cli
   ```
   This interactive tool allows you to search, add, and update asset historical data from Yahoo Finance.

4. **Stop the environment:**
   ```bash
   ./scripts/ops/dev_down.sh
   ```

### Command Palette (Makefile)
The project includes a `Makefile` to simplify common tasks:
- `make venv`: Create/update the Python virtual environment.
- `make dev`: Start the development environment.
- `make dev-down`: Stop the development environment.
- `make cli`: Open the interactive Data Manager.
- `make list`: List all available commands.

### Production Environment

1. **Start Production:**
   ```bash
   ./scripts/ops/prod_up.sh
   ```

2. **Stop Production:**
   ```bash
   ./scripts/ops/prod_down.sh
   ```

## Project Structure

```text
.
├── backend/                     # Python logic
│   ├── api/v1/                  # Endpoints (simulations, portfolios, assets)
│   ├── core/                    # Config, logging, constants
│   ├── db/                      # Database connection, session
│   ├── models/                  # SQLAlchemy models (DB tables)
│   ├── schemas/                 # Pydantic models (API request/response)
│   ├── engine/                  # Simulation Engine Core
│   │   ├── baselines/           # Logic for Basic DCA and Standard Portfolio
│   │   ├── strategies/          # Smart DCA, Rebalancing logic (Strategy Pattern)
│   │   └── calculator.py        # Vectorized calculations (ROI, Drawdown)
│   ├── data_ingestion/          # Data download logic (Yahoo/Binance)
│   ├── cli.py                   # CLI Tool entrypoint for data operations
│   ├── main.py                  # FastAPI entrypoint
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                    # Next.js app
│   ├── src/
│   │   ├── app/                 # Pages (Asset, Portfolio, Optimizer)
│   │   ├── components/          # UI Components
│   │   ├── lib/                 # API client, utils
│   │   └── types/               # TypeScript interfaces
│   └── Dockerfile
├── scripts/                     # Automation scripts
│   ├── data/                    # Data seeding/management scripts
│   └── ops/                     # Start/stop dev/prod operations
├── data/                        # Local data persistence (SQLite/CSVs)
├── docs/                        # Documentation (PRD, Architecture)
├── docker-compose.yml           # Production stack
├── docker-compose.dev.yml       # Development stack
├── .env.example                 # Environment variables template
└── .gitignore
```

## Documentation

For detailed architecture and requirements, please refer to [CONTEXT.md](./CONTEXT.md).
