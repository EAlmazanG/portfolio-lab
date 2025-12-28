# Context: Portfolio-Lab

## 1. Project Overview
**Portfolio-Lab** is a full-stack simulation and backtesting platform designed to challenge the traditional "blind" Dollar Cost Averaging (DCA) strategy. The core objective is to determine if simple algorithmic adjustments—varying the timing and amount of contributions based on technical indicators—can significantly improve ROI and reduce drawdowns for individual assets and diversified portfolios.

### The Hypothesis
By shifting investment contributions towards periods of "oversold" signals or high-momentum dips (using RSI, MACD, or Moving Averages), a "Smart DCA" should mathematically outperform a fixed-date, fixed-amount DCA over long time horizons.

---

## 2. Technical Stack
- **Backend:** Python (FastAPI/Flask) for the simulation engine and data processing.
- **Frontend:** Next.js (TypeScript) + Tailwind CSS + Shadcn/UI for the dashboard.
- **Database:** PostgreSQL (Production) / SQLite (Development) to store OHLC historical data and simulation results.
- **DevOps:** Docker & Docker Compose for multi-container orchestration (Backend, Frontend, DB).

---

## 3. Core Functional Modules

### A. Asset-Level Backtester
- **Dynamic Timing:** Shift the monthly/weekly contribution day based on technical signals.
- **Dynamic Sizing:** Increase or decrease the contribution amount based on indicators (while keeping the total annual investment constant).
- **Baselines:** Always compare against a "Basic DCA" (same total capital, fixed frequency).

### B. Portfolio-Level (Robo-Advisor Style)
- **Smart Rebalancing:** When adding new capital, prioritize assets that are "underweighted" or "oversold" relative to the target allocation.
- **Periodic Rebalancing:** Automatically reset the portfolio to target weights every $N$ months.
- **State-Aware Weighting:** Adjust weights based on whether an asset is currently undervalued/overvalued rather than just returning to a fixed percentage.

### C. The Optimizer
- **Parameter Sweeping:** Run batch simulations varying variables (e.g., RSI 30 vs RSI 40) to find the local optimum for a specific asset or portfolio.
- **Persistence:** Save optimized "recipes" for different asset classes.

---

## 4. Architectural Instructions for LLMs

### Data Logic
1. **Source of Truth:** Historical OHLC data stored in the database.
2. **Simulation Engine:** A modular Python core. Logic for "Buy Signal" and "Weighting Logic" must use the **Strategy Pattern** to allow for easy adding of new indicators.
3. **Decoupling:** The Frontend must interact with the Engine via a REST API. No business logic should reside in the Frontend.

### Calculations & Constraints
- **Budget Constraint:** In any simulation, the total capital invested per year MUST be identical to the baseline to ensure a fair "Alpha" comparison.
- **Fees:** Include a "Commission Engine" to subtract trading costs from every transaction.
- **Performance:** Optimization loops must be vectorized (using NumPy/Pandas) where possible to handle thousands of iterations.

---

## 5. Database Schema (Initial)
- `assets`: Metadata for BTC, ETH, SP500, etc.
- `historical_data`: Daily OHLC prices for all assets.
- `portfolios`: User-defined asset mixes (e.g., 60% SP500, 40% BTC).
- `simulations`: Result sets including Final Value, ROI, Max Drawdown, and Sharpe Ratio.

---

## 6. Implementation Roadmap
1. **Infrastructure:** Docker setup + Database initialization.
2. **Data Ingestion:** Python scripts to fetch data from APIs (Yahoo Finance, Binance, etc.).
3. **Single Asset Engine:** Core logic for Dynamic DCA vs. Basic DCA.
4. **Portfolio Engine:** Implementation of rebalancing and multi-asset logic.
5. **Full-Stack UI:** Next.js dashboard with three main tabs: **Asset**, **Portfolio**, and **Optimizer**.

---

## 7. Guidelines for Code Generation
- **Python:** Use Pydantic for data validation. Follow PEP 8. Prioritize clean, documented classes for the simulation engine.
- **Frontend:** Use Functional Components with Tailwind. Ensure charts (Recharts or Chart.js) are responsive.
- **API:** Standardized JSON responses: `{ "status": "success", "data": {...}, "metrics": {...} }`.