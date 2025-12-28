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
   - **Frontend:** [http://localhost:3000](http://localhost:3000)
   - **Database:** `localhost:5432`

2. **Stop the environment:**
   ```bash
   ./scripts/ops/dev_down.sh
   ```

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
├── backend/                     # Python logic (FastAPI, Simulation Engine)
│   ├── api/v1/                  # Endpoints
│   ├── engine/                  # Core Simulation Logic (DCA, Strategies)
│   ├── data_ingestion/          # Data fetchers
│   └── Dockerfile
├── frontend/                    # Next.js app
│   ├── src/                     # Source code
│   └── Dockerfile
├── scripts/ops/                 # DevOps automation scripts
├── docker-compose.yml           # Production configuration
└── docker-compose.dev.yml       # Development configuration
```

## Documentation

For detailed architecture and requirements, please refer to [CONTEXT.md](./CONTEXT.md).
