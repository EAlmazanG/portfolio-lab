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
   make dev-start
   ```
   This command builds the Docker containers and starts the services in development mode with hot-reloading.
   
   - **Backend API:** [http://localhost:8000/docs](http://localhost:8000/docs)
   - **Frontend:** [http://localhost:3000](http://localhost:3000)
   - **Database:** `localhost:5433` (external port)

2. **Full Production Run:**
   ```bash
   make start portfolio-lab
   ```
   This is the quickest way to run the full app: it activates the environment, starts production containers, and automatically opens the browser.

3. **Manage Data (CLI):**
   ```bash
   make backend-cli
   ```
   This interactive tool allows you to search, add, and update asset historical data from Yahoo Finance.

4. **Stop everything:**
   ```bash
   make close
   ```

### Dashboard Features
- **Smart DCA:** Toggle Dynamic Timing and Dynamic Sizing based on RSI, MA, or EMA.
- **Safety Floor:** Ensure you never miss a buy opportunity with the "Min Sizing" floor.
- **Advanced History:** Organize your best simulations using the **Favorites (Star)** system.
- **Synchronized Charts:** Analyze price, growth, and contributions with synchronized zooming and filtering.

### Command Palette (Makefile)
The project includes a comprehensive `Makefile`:
- `make start portfolio-lab`: Full automated production startup.
- `make close`: Stop and clean all containers (dev/prod).
- `make dev-start` / `make dev-stop`: Manage development environment.
- `make backend-cli`: Open the interactive Data Manager.
- `make backend-test`: Run Python tests.
- `make shell`: Activate virtual environment directly.

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
