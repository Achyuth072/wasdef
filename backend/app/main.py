from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.config import router as config_router
from app.api.forecasts import router as forecasts_router

app = FastAPI(
    title="Wind Forecast & Procurement Portal API",
    version="1.0.0",
    description="UK Day-Ahead Wind Generation Forecasting & Procurement Alignment API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(config_router)
app.include_router(forecasts_router)


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    return {"status": "healthy", "service": "wind-forecast-portal"}


# Mount static assets if built frontend is present
static_dir = Path("/app/static")
if not static_dir.exists():
    static_dir = Path(__file__).parent.parent.parent / "frontend" / "dist"

if static_dir.exists():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")

