import sys
import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

# Set loop policy for Windows if needed
if sys.platform == "win32":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except Exception:
        pass

from app.config import settings
from app.database import engine, get_db, check_database_connection

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("app.main")

from app.services.timer_service import start_scheduler, shutdown_scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting AI-Based Intelligent Examination Platform backend...")
    # Verify Database Connection
    db_ok = await check_database_connection()
    if db_ok:
        logger.info("Successfully connected to PostgreSQL database!")
    else:
        logger.error("WARNING: Could not establish connection to database at startup.")
    
    # Start APScheduler for exam timeouts
    start_scheduler()
    yield
    # Graceful shutdown
    logger.info("Shutting down timer scheduler...")
    shutdown_scheduler()
    logger.info("Shutting down database engine...")
    await engine.dispose()
    logger.info("Backend shutdown complete.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for AI-Based Intelligent Examination Platform with Automated Proctoring and Candidate Performance Analysis.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Configure CORS
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://localhost:8001",
    "http://127.0.0.1:8001",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.staticfiles import StaticFiles
from pathlib import Path

# Mount static uploads
Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Mount Routers
from app.routers.auth import router as auth_router
from app.routers.questions import router as questions_router
from app.routers.exams import router as exams_router
from app.routers.exam_sessions import router as exam_sessions_router
from app.routers.answers import router as answers_router
from app.routers.proctoring import router as proctoring_router
from app.routers.examiner import router as examiner_router
from app.routers.results import router as results_router
from app.routers.admin import router as admin_router
from app.websocket.proctoring import router as proctor_ws_router

app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(questions_router, prefix=settings.API_V1_STR)
app.include_router(exams_router, prefix=settings.API_V1_STR)
app.include_router(exam_sessions_router, prefix=settings.API_V1_STR)
app.include_router(answers_router, prefix=settings.API_V1_STR)
app.include_router(proctoring_router, prefix=settings.API_V1_STR)
app.include_router(examiner_router, prefix=settings.API_V1_STR)
app.include_router(results_router, prefix=settings.API_V1_STR)
app.include_router(admin_router, prefix=settings.API_V1_STR)
app.include_router(proctor_ws_router, prefix=settings.API_V1_STR)

@app.get("/", tags=["General"])
async def root():
    return {
        "message": "AI-Based Intelligent Examination Platform API is running",
        "docs": "/docs",
        "status": "online",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

@app.get("/api/health", tags=["General"])
async def health_check(db: AsyncSession = Depends(get_db)):
    db_connected = False
    try:
        res = await db.execute(text("SELECT 1;"))
        db_connected = (res.scalar() == 1)
    except Exception as e:
        logger.error(f"Healthcheck DB ping failed: {e}")

    status_code = status.HTTP_200_OK if db_connected else status.HTTP_503_SERVICE_UNAVAILABLE
    return JSONResponse(
        status_code=status_code,
        content={
            "status": "healthy" if db_connected else "degraded",
            "database": "connected" if db_connected else "disconnected",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "version": "1.0.0",
        }
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.BACKEND_HOST, port=settings.BACKEND_PORT, reload=True)
