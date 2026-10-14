import logging
import time

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.routers.runs import router as runs_router
from app.settings import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("floodsight.server")

app = FastAPI(
    title="FloodSight Himalaya API",
    description="Backend API for mapping flood extent, infrastructure exposure, and settlement cut-off.",
    version="0.1.0",
)

# ---------------- CORS Configuration ----------------
# Allow strictly configured origins without wildcard or regex
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# ---------------- Request Logging Middleware ----------------
@app.middleware("http")
async def log_requests_middleware(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration_ms = (time.time() - start_time) * 1000

    # NFR-04 Logging: Log request path, method, status, and duration
    logger.info(
        "%s %s -> %d in %.2fms",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


# ---------------- Global Error Handlers ----------------
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(_request: Request, exc: StarletteHTTPException):
    detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": detail},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError):
    # Format error message cleanly for the frontend
    messages = []
    for err in exc.errors():
        loc = ".".join(str(p) for p in err.get("loc", []))
        msg = err.get("msg", "invalid")
        messages.append(f"{loc}: {msg}")
    summary = "; ".join(messages[:3]) if messages else "Invalid request data"
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": summary},
    )


@app.exception_handler(Exception)
async def global_exception_handler(_request: Request, exc: Exception):
    logger.exception("Unhandled server exception: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": f"Internal server error: {exc!s}"},
    )


# ---------------- Health Endpoint ----------------
@app.get("/api/health")
async def health_check():
    return {"status": "ok"}


# Mount API routers
app.include_router(runs_router)
