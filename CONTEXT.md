# Context: Portfolio-Lab

## 1. Project Overview
**Portfolio-Lab** is a full-stack simulation and backtesting platform designed to challenge the traditional "blind" Dollar Cost Averaging (DCA) strategy. The core objective is to determine if simple algorithmic adjustments—varying the timing and amount of contributions based on technical indicators—can significantly improve ROI and reduce drawdowns for individual assets and diversified portfolios.

### The Hypothesis
By shifting investment contributions towards periods of "oversold" signals or high-momentum dips (using RSI, MACD, or Moving Averages), a "Smart DCA" should mathematically outperform a fixed-date, fixed-amount DCA over long time horizons, while strictly maintaining the same total annual capital investment.

---

## 2. Product Requirements Document (PRD)

### 2.1. Core Tool: Simulation Engine
The tool aims to simulate automated variations of DCA for single assets and ad-hoc portfolios. It compares these "Smart" strategies against standard Baselines to measure "Alpha" generation.

#### Supported Assets
A flexible "Robo-Advisor" style selection, including but not limited to:
- **Crypto:** BTC, ETH.
- **Indices:** S&P 500, NASDAQ, IBEX 35, DAX.
- **Commodities:** Gold.

### 2.2. Functional Features

#### A. Asset-Level Features
1.  **Dynamic Contribution Timing:**
    *   Vary the specific day of contribution (e.g., waiting for a dip within the month) based on technical signals.
2.  **Dynamic Contribution Sizing:**
    *   Increase or decrease the contribution amount based on asset valuation (e.g., buy more when oversold, less when overbought).
    *   **Constraint:** The total capital invested per year must remain constant relative to the baseline.

#### B. Portfolio-Level Features
1.  **Smart Contribution Balancing:**
    *   When adding new capital (monthly/weekly), distribute it dynamically.
    *   Prioritize assets that are "underweighted" or "oversold" and reduce allocation to "overweighted" or "overbought" assets.
2.  **Periodic Rebalancing:**
    *   **Trigger:** Executed every $N$ months (user-configurable).
    *   **Modes:**
        *   *Standard:* Revert to original target percentages.
        *   *Smart:* Adjust target weights based on current technical state (overweight undervalued assets, underweight overvalued ones).

### 2.3. Baselines for Comparison
To validate the hypothesis, every simulation must be compared against:
1.  **Asset Baseline:** Basic DCA (Fixed Amount, Fixed Date/Interval).
2.  **Portfolio Baseline:** Standard Portfolio (Fixed Target Allocation, Periodic Standard Rebalancing).

### 2.4. Technical Indicators (Detection Variables)
- **RSI** (Relative Strength Index).
- **Moving Averages** (SMA/EMA).
- **MACD** (Moving Average Convergence Divergence).

### 2.5. Advanced Features (Future Scope - Do Not Implement Yet)
- AI/LLM integration for sentiment analysis and news-based adjustment.

---

## 3. System Components & Architecture

### 3.1. Directory Structure

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

### 3.2. Data Ingestion Module
- **Responsibility:** Fetch and persist historical market data.
- **Source:** External APIs (e.g., Yahoo Finance).
- **Storage:** Database (Daily OHLC values).
- **Interface:** A simple CLI (Command Line Interface) tool to search, select, and download asset history. No frontend required for this module.

### 3.3. Backend (Python)
- **Framework:** Python (FastAPI/Flask recommended for REST API).
- **Simulation Engine:**
    - Core logic to process Assets, Parameters, and Selected Features.
    - **Commission Engine:** Logic to deduct trading fees/slippage from every transaction for realistic results.
- **Testing Engine:**
    - Runs the "Smart" strategy and the "Baseline" strategy in parallel.
    - Calculates performance metrics (ROI, Drawdown, Volatility) and generates comparison data.
- **API Layer:**
    - Exposes endpoints for the Frontend to configure simulations, trigger runs, and retrieve results.
    - Ensures total decoupling of UI and Business Logic.

### 3.4. Frontend (Next.js)
- **Architecture:** Next.js Application organized into three main functional tabs.
- **Prototypes:** Detailed UI designs available in `stitch/` folder:
  - **Format:** HTML files with embedded CSS/JS and accompanying PNG screenshots.
  - **Location:** Organized by feature/component (e.g., `stitch/single_asset_simulation/`).
  - **Current Assets:** Single asset simulation prototype (`code.html` + `screen.png`).
- **Tabs:**

    1.  **Asset Tab:**
        *   **Asset Selection:** Dropdown/combobox to select from available assets in database.
        *   **Commission Toggle:** Checkbox to enable/disable trading fees and commissions.
        *   **Feature Selection:** Enable/disable specific features per asset (Timing, Sizing, etc.).
        *   **Parameter Adjustment:** Sliders/inputs for each selected feature (limited to 1 parameter per feature).
        *   **Simulation Control:** Run button to execute simulation with current configuration.
        *   **Results Visualization:** Charts showing value and ROI over time.
        *   **Baseline Comparison:** Side-by-side comparison with standard DCA results.
        *   **Persistence:** Save/load functionality for asset simulation configurations.

    2.  **Portfolio Tab:**
        *   **Portfolio Construction:** Multi-select interface to add assets to portfolio with weight allocation (percentage-based).
        *   **Asset-Level Features:** For each portfolio asset, enable/disable features and adjust parameters (1 parameter per feature).
        *   **Portfolio-Level Features:** When multiple assets exist, enable portfolio-wide features (Smart Rebalancing, etc.).
        *   **Simulation Execution:** Launch portfolio simulations with all configured assets and features.
        *   **Results Display:**
            - **Baselines:** Standard portfolio performance (fixed allocations, regular rebalancing).
            - **Results:** Interactive charts showing portfolio value, individual asset performance, and total ROI.
            - **Comparisons:** Detailed comparisons between smart strategies vs. baselines (both asset-level and portfolio-level).
        *   **Persistence:** Save/load functionality for complete portfolio configurations.

    3.  **Optimizer Tab:**
        *   **Scope Selection:** Choose between single asset or existing portfolio for optimization.
        *   **Feature Configuration:** Select features and define parameter ranges for iteration.
        *   **Batch Execution:** Run multiple simulations varying parameters across defined ranges.
        *   **Optimization Results:** Display best-performing parameter combinations with performance metrics.
        *   **Persistence:** Save/load functionality for optimization configurations and results.

- **Persistence:**
    *   Save/Load constructed Portfolios.
    *   Save/Load Simulation Results (Asset & Optimization runs).

### 3.5. DevOps & Infrastructure
- **Containerization:** Docker & Docker Compose.
    *   **Development:** Mounts local source code as volumes for hot-reloading.
    *   **Production:** Standalone containers for Backend, Frontend, and DB.
- **Database:**
    *   **Assets Table:** Metadata and Historical OHLC data.
    *   **Portfolios Table:** Saved portfolio configurations.
    *   **Simulations Table:** Results of single-asset and portfolio runs.
    *   **Optimizations Table:** Results of batch optimization jobs.
- **Automation:** Bash scripts to launch the environment (`dev` vs. `prod`) and initialize the database.

---

## 4. Implementation Roadmap (Planning)

1.  **Project Initialization:**
    *   Repo setup, naming, and `CONTEXT.md` creation.
    *   Define architectural rules and directory structure.
    *   Docker & Docker Compose setup (Dev/Prod).
2.  **Data Foundation:**
    *   Identify Data Source (API).
    *   Build CLI Tool for Data Ingestion.
    *   Download sample data (BTC, SP500, etc.) and verify DB storage.
3.  **Asset Engine (Backend):**
    *   Implement Basic DCA Baseline.
    *   Implement "Smart" Features (Timing, Sizing).
    *   Implement Commission Logic.
    *   Create API Endpoints for Asset Simulation.
4.  **Asset Frontend:**
    *   Reference `stitch/single_asset_simulation/` prototypes for UI design.
    *   Build "Asset" Tab with asset selection, feature toggles, and parameter controls.
    *   Connect to Backend API for simulation execution.
    *   Implement charts for value/ROI visualization and baseline comparisons.
5.  **Portfolio Engine (Backend):**
    *   Implement Portfolio Construction & Weighting.
    *   Implement Rebalancing Logic (Standard & Smart).
    *   Create API Endpoints for Portfolio Simulation.
6.  **Portfolio Frontend:**
    *   Build "Portfolio" Tab.
    *   Asset selection and weight configuration UI.
    *   Visualize aggregate performance.
7.  **Optimizer Engine & Frontend:**
    *   Implement batch processing for parameter sweeping.
    *   Build "Optimizer" Tab to trigger and view results.
8.  **Refinement:**
    *   Data persistence (Saving Portfolios/Simulations).
    *   UI/UX Polish and Format debugging.

---

## 6. Current Progress (v0.8 Completed)

### 6.1. Infrastructure & DevOps
- **Dockerization:** Fully containerized environment with separate `dev` (hot-reloading, volume mounts) and `prod` configurations.
- **Database:** PostgreSQL set up with SQLAlchemy ORM and Alembic for migrations (added Risk Metrics support).
- **Backend:** FastAPI foundation with health checks and CORS configuration.
- **Frontend:** Next.js 14 (App Router) with TypeScript, Tailwind CSS, Recharts, and Lucide icons.
- **Automation:** Refactored `Makefile` with clear commands (`make dev-up`, `make prod-up`, `make start portfolio-lab`, `make test-all`).
- **Favicon:** Custom SVG favicon (`public/icon.svg`) with the Portfolio-Lab brand (green chart line on dark background).

### 6.2. Data Ingestion & Management
- **Yahoo Finance Client:** Robust integration for fetching OHLCV data, asset metadata, and search (up to 20 results per query).
- **Interactive CLI Tool:** A comprehensive data manager (`make backend-cli`).
- **Visual Index:** Frontend logic to construct and normalize weighted price indices for portfolios.

### 6.3. Advanced Simulation Engine (v0.8)
- **Portfolio Core Logic:** 
    - The `PortfolioSimulationEngine` orchestrates multiple `SimulationEngine` instances.
    - **Rebalancing Engine:** Supports periodic rebalancing (1-24 months), selling winners and buying laggards to maintain strategy integrity.
    - **Smart DCA Compatibility:** Seamlessly integrates with per-asset Smart DCA features (Timing and Sizing).
    - **Aggregation Engine:** Uses Pandas `reindex` and `ffill` logic to align assets with different historical start dates.
- **Advanced Financial Metrics:** Volatility, Max Drawdown (MDD), and Strategy Alpha.
- **Robust Data Pipeline:** 
    - **Indicator Safeguards:** Technical indicators (MA/EMA) return `null` instead of `0.0` during their initial calculation windows.
    - **Clean Scaling:** All values are rounded and cleaned for JSON serialization to handle `NaN` or `Inf`.
    - **Smart DCA reliability:** Uses the latest available indicator row when an asset does not trade daily.
- **Backend Schema Validation:**
    - `PortfolioSimulationCreate` includes a `@model_validator(mode='before')` to normalize `asset_configs` keys from string to int, ensuring the engine always finds configs by int key.

### 6.4. Frontend Pages & Features (v0.8)

#### Page 1: Asset Simulation (`/`)
- Single-asset DCA simulation with Smart DCA toggles (Timing, Sizing).
- Indicator selection: RSI, MA, EMA with configurable thresholds.
- Commission engine with percentage fees, minimum per trade, and annual maintenance.
- Charts: Portfolio Growth, Price & Indicators (synced), RSI sub-chart, Contributions with Brush, Fees Impact, Accumulation.
- Simulation history with favorites, load/delete, and delete-all.
- **Performance:** All 6 charts use memoized `chartHistory` (downsampled to 500 points max).

#### Page 2: Portfolio Management (`/portfolios`)
- Create, edit, and delete portfolios with multi-asset composition.
- Per-asset weight allocation (percentage-based) with real-time validation.
- Current position tracking (amount, avg price).
- HHI diversification index with visual classification.
- Navigate directly to Portfolio Simulation with selected portfolio.

#### Page 3: Portfolio Simulation (`/portfolio-analysis`)
- Multi-asset portfolio simulation with per-asset Smart DCA configuration.
- Rebalancing engine (1-24 month intervals) with visual markers.
- Charts: Portfolio Growth Evolution, Final Allocation (Pie), Strategy Metrics, Individual Asset Deep-Dive.
- Per-asset deep-dive: Market Price chart, RSI/MA/EMA indicator sub-chart, Contributions bar chart.
- **Performance optimizations (v0.8):**
    - `useMemo` for `chartHistory` (450 points), `assetHistories` per asset (200 points), and `rebalancingCount`.
    - All chart animations disabled (`isAnimationActive={false}`).
    - `Brush` removed from per-asset contribution charts.
    - `syncId` removed from per-asset charts to prevent cross-chart re-render cascades.
    - Asset detail sections collapsed by default (`expandedAssets` state) — charts only render when user expands.
    - ReferenceLine loops use downsampled `chartHistory` instead of full `portfolio_history`.

#### Page 4: Asset Management (`/assets-manager`)
- **Add Asset workflow:**
    - Yahoo Finance search with auto-complete (debounced 350ms).
    - Search returns up to 20 results with infinite scroll (8 visible, loads 10 more on scroll).
    - Asset info panel: name, type, sector, market cap, currency, description (expandable), website link.
    - **Weekly Candles (5y) preview:** Custom SVG candlestick chart with dynamic height (aspect ratio 0.28), responsive to container width via `ResizeObserver`. No grid lines.
    - One-click asset creation with automatic history download.
    - Duplicate detection ("Already in your library" indicator).
- **Manage Assets workflow:**
    - Searchable asset library with filter.
    - Asset snapshot: ticker, type, sector, date range, record count, price chart preview.
    - Gear menu modal: Download history (configurable years/interval), Delete asset with confirmation.
- **General Settings:**
    - Configure default ingestion years and interval (1d, 1wk, 1mo).
    - Bulk "Update All Assets" action.
- **Sidebar:** Collapsible left sidebar showing simulation history and portfolio simulation history with expandable details.

### 6.5. Shared Components
- **Header:** Sticky navigation bar with links to all 4 pages, active state highlighting, and Portfolio-Lab branding with animated chart icon.
- **Custom Scrollbar:** `custom-scrollbar` CSS class for consistent dark-themed scrollbars.
- **Background Grid:** Subtle grid pattern overlay on main content areas.

### 6.6. API Endpoints

#### Assets Manager (`/api/v1/assets-manager`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/assets` | List all managed assets with stats |
| GET | `/settings` | Get ingestion settings |
| PUT | `/settings` | Update ingestion settings |
| GET | `/search?q=` | Search Yahoo Finance (up to 20 results) |
| GET | `/assets/{ticker}/info` | Get asset metadata from Yahoo |
| GET | `/assets/{ticker}/ohlc` | Get 5-year weekly OHLC preview |
| POST | `/assets` | Create asset and optionally download history |
| POST | `/assets/{id}/download` | Download/update asset history |
| POST | `/assets/update-all` | Bulk update all assets |
| DELETE | `/assets/{id}` | Delete asset and all market data |

#### Simulations (`/api/v1/simulations`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/run` | Run single-asset simulation |
| GET | `/history` | List simulation history |
| GET | `/{id}` | Get simulation details |
| DELETE | `/{id}` | Delete simulation |
| PATCH | `/{id}/favorite` | Toggle favorite |
| DELETE | `/history/all` | Delete all simulations |

#### Portfolios (`/api/v1/portfolios`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List portfolios |
| POST | `/` | Create portfolio |
| GET | `/{id}` | Get portfolio details |
| PUT | `/{id}` | Update portfolio |
| DELETE | `/{id}` | Delete portfolio |

#### Portfolio Simulations (`/api/v1/portfolio-simulations`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/run` | Run portfolio simulation |
| GET | `/history` | List portfolio simulation history |
| GET | `/{id}` | Get simulation details |
| DELETE | `/{id}` | Delete simulation |
| PATCH | `/{id}/favorite` | Toggle favorite |
| DELETE | `/history/all` | Delete all portfolio simulations |

### 6.7. Testing (v0.8)
- **Frontend tests (5 suites, 9 tests):**
    - `Header.test.tsx` — Navigation links and branding render correctly.
    - `AssetManagerPage.test.tsx` — Action buttons (Add, Manage, Settings) render.
    - `AssetSimulationPage.test.tsx` — Page renders with simulation controls.
    - `PortfolioAnalysisPage.test.tsx` — Page renders with simulation controls.
    - `PortfoliosPage.test.tsx` — Portfolio management UI renders.
- **Backend tests:**
    - Integration tests for infrastructure health checks.
    - Unit tests for simulation engine, smart features, and payload normalization.
- **All tests pass:** `npx jest` (frontend), `pytest tests/unit` (backend).

### 6.8. Known Limitations
- Yahoo Finance search API may return fewer than 20 results for some queries (API limitation, not a bug).
- `act(...)` warnings in frontend tests are cosmetic (React async state updates) — do not affect test results.
- No backend tests for API routes (only engine and integration tests exist).
- Optimizer tab is not yet implemented (future scope).

---

## 7. Development Rules & Best Practices

1.  **Capital Constraint:** In *all* comparisons, the total capital deployed in the "Smart" strategy must exactly match the "Baseline" strategy on an annual basis.
2.  **Strategy Pattern:** Use the Strategy Design Pattern for Indicators and Buying Logic to ensure modularity and easy extensibility.
3.  **Strict Decoupling:** The Frontend is a view layer only. All financial calculations, simulations, and data processing happen in the Python Backend.
4.  **Vectorization & Robustness:** 
    - Use Pandas/NumPy for performance and data alignment.
    - Always use `ffill()` for cumulative values and `fillna(0)` for discrete events when aggregating time-series data.
5.  **Chart Fidelity:**
    - Indicators (MA/EMA/RSI) must never plot artificial zero-values. Use `null` if the calculation window is incomplete.
    - Cumulative charts must start at the **Initial Capital** value on the selected start date.
6.  **Type Safety:** Use Pydantic models for all Backend API request/response structures. Use TypeScript interfaces for all Frontend data.
7.  **Educational UI:** Every chart and non-trivial metric must include an "Info" tooltip explaining its financial significance.
8.  **Source of Truth:** Keep this `CONTEXT.md` updated as the primary reference for system behavior.
