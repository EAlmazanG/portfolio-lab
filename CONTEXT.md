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

## 6. Current Progress (v0.7 Completed)

### 6.1. Infrastructure & DevOps
- **Dockerization:** Fully containerized environment with separate `dev` (hot-reloading, volume mounts) and `prod` configurations.
- **Database:** PostgreSQL set up with SQLAlchemy ORM and Alembic for migrations (added Risk Metrics support).
- **Backend:** FastAPI foundation with health checks and CORS configuration.
- **Frontend:** Next.js (App Router) structure with TypeScript and Tailwind CSS.
- **Automation:** Refactored `Makefile` with clear commands (`make dev-start`, `make prod-start`, `make start portfolio-lab`).

### 6.2. Data Ingestion & Management
- **Yahoo Finance Client:** Robust integration for fetching OHLCV data and asset metadata.
- **Interactive CLI Tool:** A comprehensive data manager (`make backend-cli`).
- **Visual Index:** Frontend logic to construct and normalize weighted price indices for portfolios.

### 6.3. Advanced Simulation Engine (v0.7)
- **Portfolio Core Logic:** 
    - The `PortfolioSimulationEngine` orchestrates multiple `SimulationEngine` instances.
    - **Rebalancing Engine:** Supports periodic rebalancing:
        1. **Periodic Rebalancing:** Automatically resets asset weights to original targets every N months (1-24), selling winners and buying laggards to maintain strategy integrity.
    - **Smart DCA Compatibility:** Seamlessly integrates with per-asset Smart DCA features (Timing and Sizing), allowing for complex multi-layered strategies.
    - **Aggregation Engine:** Uses Pandas `reindex` and `ffill` logic to align assets with different historical start dates.
- **Advanced Financial Metrics:** 
    - **Volatility:** Calculated as the annualized standard deviation of periodic returns.
    - **Max Drawdown (MDD):** Tracks the peak-to-trough decline to quantify worst-case scenario risk.
    - **Strategy Alpha:** Measuring the net outperformance of "Smart" logic vs. a standard fixed-interval DCA baseline.
- **Robust Data Pipeline:** 
    - **Indicator Safeguards:** Technical indicators (MA/EMA) return `null` instead of `0.0` during their initial calculation windows, preventing visualization distortions.
    - **Clean Scaling:** All values are rounded and cleaned for JSON serialization to handle edge cases like `NaN` or `Inf`.
    - **Smart DCA reliability:** Smart timing/sizing now uses the latest available indicator row when an asset does not trade daily, ensuring signals are applied consistently across all assets.

### 6.4. Frontend & UX Excellence (v0.7)
- **High-Fidelity Visualizations:**
    - **Synchronized Charts:** Leveraging Recharts `syncId` to correlate price action with buy/sell signals and accumulation curves across different chart components.
    - **Temporal Filtering:** Global `Brush` component allows users to inspect specific market cycles or volatility events in detail.
    - **RSI Sub-charts:** Professional RSI representation with decoupled axes, reference lines at 30/70, and shaded areas for clarity.
- **Visual Index Construction:** Frontend logic to normalize and weight multiple assets into a single "Portfolio Index" (Base 100), providing a clean comparative benchmark.
- **Professional UI/UX:**
    - **Unified Theme:** Harmonized background colors, typography, and pulsing animations across all views.
    - **Contextual Intelligence:** Informative tooltips for every metric, providing English explanations of financial concepts.
    - **Responsive Architecture:** Sidebars utilize fixed widths and `overflow-visible` containers to ensure smooth, flicker-free transitions.
    - **Performance tuning:** Charts now use downsampled datasets, shared per-asset history, and disabled animations to reduce UI slowdowns while preserving key contribution and indicator points.
    - **Rebalancing markers:** Distribution and growth charts render clearer rebalance markers with consistent styling.

### 6.5. Testing & QA (v0.7)
- **Frontend payload coverage:** Added integration-style tests that mirror frontend JSON payloads (string keys) and verify backend normalization.
- **Smart feature regression:** Added tests to ensure smart timing/sizing changes returns when enabled (including last-asset edge cases).
- **Persistence & history:** Added tests for save/load consistency and initial value handling.

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
