from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.v1 import (
    simulation_router, 
    portfolio_router,
    portfolio_simulation_router,
    assets_manager_router,
)

app = FastAPI(title="Portfolio-Lab API", version="0.1.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(simulation_router, prefix="/api/v1")
app.include_router(portfolio_router, prefix="/api/v1")
app.include_router(portfolio_simulation_router, prefix="/api/v1")
app.include_router(assets_manager_router, prefix="/api/v1")

@app.get("/")
async def root():
    return {"message": "Welcome to Portfolio-Lab API", "status": "running"}

@app.get("/api/v1/health")
async def health_check():
    return {"status": "ok", "service": "backend"}

