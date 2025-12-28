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
- **Tabs:**
    1.  **Asset:**
        *   Select Asset.
        *   Toggle Commission/Fees.
        *   Enable/Disable specific Features (Timing, Sizing).
        *   Adjust Parameters (limit to 1 parameter per feature for initial version).
        *   Run Simulation & View Results (Charts: Value vs. Time, ROI vs. Time).
        *   Compare vs. Baseline.
    2.  **Portfolio:**
        *   Build Portfolio (Select multiple assets and weights).
        *   Configure Portfolio-level features (Rebalancing rules).
        *   Run Simulation & View Aggregate Results.
        *   Compare vs. Portfolio Baseline.
    3.  **Optimizer:**
        *   Batch simulation runner.
        *   Iterate through parameter ranges to find optimal settings for a specific asset or portfolio.
        *   Display best performing configurations.
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
    *   Build "Asset" Tab.
    *   Connect to Backend API.
    *   Visualize charts and comparisons.
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

## 5. Development Rules & Best Practices

1.  **Capital Constraint:** In *all* comparisons, the total capital deployed in the "Smart" strategy must exactly match the "Baseline" strategy on an annual basis.
2.  **Strategy Pattern:** Use the Strategy Design Pattern for Indicators and Buying Logic to ensure modularity and easy extensibility.
3.  **Strict Decoupling:** The Frontend is a view layer only. All financial calculations, simulations, and data processing happen in the Python Backend.
4.  **Vectorization:** Use Pandas/NumPy vectorization for simulation loops to ensure high performance, especially for the Optimizer.
5.  **Type Safety:** Use Pydantic models for all Backend API request/response structures. Use TypeScript interfaces for all Frontend data.
6.  **Documentation:** Keep this `CONTEXT.md` updated as the "Source of Truth" for the project scope.
