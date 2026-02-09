# Portfolio-Lab

**Portfolio-Lab** is a full-stack simulation and backtesting platform designed to challenge the traditional "blind" Dollar Cost Averaging (DCA) strategy. It compares "Smart DCA" strategies (using RSI, MA, EMA indicators) against standard baselines to measure alpha generation for individual assets and diversified portfolios.

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Python 3.13+ (optional, for local CLI tools)
- Node.js 20+ (optional, for local frontend development)

### Development Environment

```bash
make dev-up
```

This builds and starts all services in development mode with hot-reloading.

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3001 |
| Backend API (Swagger) | http://localhost:8000/docs |
| Database (PostgreSQL) | localhost:5433 |

### Production

```bash
make start portfolio-lab
```

Builds production containers and opens the browser automatically.

### Stop Everything

```bash
make close
```

## Pages

### 1. Asset Simulation (`/`)
Single-asset DCA backtesting with Smart DCA toggles (Dynamic Timing, Dynamic Sizing). Configure RSI/MA/EMA indicators, commission fees, and investment frequency. Visualize results with synchronized charts for portfolio growth, price action, indicators, contributions, fees, and accumulation.

### 2. Portfolio Management (`/portfolios`)
Create and manage multi-asset portfolios with percentage-based weight allocation. Track current positions, average prices, and diversification (HHI index). Navigate directly to Portfolio Simulation.

### 3. Portfolio Simulation (`/portfolio-analysis`)
Multi-asset portfolio simulation with per-asset Smart DCA configuration and periodic rebalancing (1-24 months). Deep-dive into individual asset performance with price, indicator, and contribution charts. Collapsed by default for performance.

### 4. Asset Management (`/assets-manager`)
Full asset lifecycle management. Search Yahoo Finance (up to 20 results with infinite scroll), preview 5-year weekly candlestick charts, and ingest assets with one click. Manage existing assets, download/update history, and configure global ingestion settings.

## Key Features

- **Smart DCA Engine** — Dynamic Timing and Sizing based on RSI, MA, or EMA with zero look-ahead bias.
- **Portfolio Rebalancing** — Periodic rebalancing (1-24 months) that sells winners and buys laggards.
- **Commission Engine** — Percentage fees, minimum per trade, and annual maintenance fees.
- **Risk Metrics** — Volatility, Max Drawdown (MDD), and Strategy Alpha.
- **Candlestick Preview** — Custom SVG candlestick chart (5y weekly) with responsive sizing.
- **Performance Optimized** — Downsampled charts (200-500 points), memoized computations, disabled animations, lazy-rendered asset sections.
- **Simulation History** — Persistent history with favorites system and at-a-glance metrics.
- **Interactive CLI** — `make backend-cli` for searching, adding, and updating assets from the terminal.

## Command Palette

| Command | Description |
|---------|-------------|
| `make start portfolio-lab` | Full production startup + open browser |
| `make close` | Stop all containers (dev + prod) |
| `make dev-up` / `make dev-down` | Start/stop development environment |
| `make dev-logs` | Follow development container logs |
| `make prod-up` / `make prod-down` | Start/stop production environment |
| `make backend-cli` | Interactive data manager CLI |
| `make test-all` | Run all tests (frontend + backend) |
| `make frontend-test` | Run frontend Jest tests |
| `make backend-unit-test` | Run backend unit tests |
| `make backend-test` | Run backend integration tests |
| `make shell` | Activate virtual environment |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, Recharts, Lucide |
| Backend | Python 3.13, FastAPI, Pydantic v2, SQLAlchemy |
| Database | PostgreSQL |
| Data Source | Yahoo Finance (yfinance) |
| Infrastructure | Docker, Docker Compose, Makefile |
| Testing | Jest + React Testing Library (frontend), pytest (backend) |

## Project Structure

```text
.
├── backend/
│   ├── api/v1/                  # REST endpoints (4 routers)
│   ├── core/                    # Config, logging
│   ├── db/                      # SQLAlchemy session, CRUD operations
│   ├── models/                  # DB models (Asset, MarketData, Portfolio, etc.)
│   ├── schemas/                 # Pydantic request/response schemas
│   ├── engine/                  # Simulation engines (asset + portfolio)
│   │   ├── baselines/           # Standard DCA logic
│   │   ├── strategies/          # Smart DCA, Rebalancing
│   │   └── calculator.py        # ROI, Drawdown, Volatility
│   ├── services/                # Business logic (AssetsManagerService)
│   ├── data_ingestion/          # Yahoo Finance client
│   ├── cli.py                   # Interactive CLI tool
│   └── main.py                  # FastAPI entrypoint
├── frontend/
│   ├── src/
│   │   ├── app/                 # 4 pages + layout
│   │   │   ├── page.tsx                    # Asset Simulation
│   │   │   ├── portfolios/page.tsx         # Portfolio Management
│   │   │   ├── portfolio-analysis/page.tsx # Portfolio Simulation
│   │   │   └── assets-manager/page.tsx     # Asset Management
│   │   ├── components/          # Header
│   │   ├── lib/api.ts           # API client (all endpoints)
│   │   └── types/               # TypeScript interfaces
│   ├── public/icon.svg          # Favicon
│   └── __tests__/               # 5 test suites
├── tests/                       # Backend tests (unit + integration)
├── docker-compose.yml           # Production stack
├── docker-compose.dev.yml       # Development stack
├── Makefile                     # Command palette
├── CONTEXT.md                   # Full architecture & progress docs
└── README.md
```

## Documentation

For detailed architecture, PRD, API endpoints, and implementation progress, see [CONTEXT.md](./CONTEXT.md).
