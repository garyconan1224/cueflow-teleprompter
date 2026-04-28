from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from backend.app.api.websocket import create_websocket_router
from backend.app.asr.engine import StreamingASREngine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"

app = FastAPI(title="Voice Teleprompter Backend", version="0.3.0")
engine = StreamingASREngine()
app.include_router(create_websocket_router(engine))


@app.on_event("startup")
async def on_startup() -> None:
    await engine.warmup()


@app.get("/health")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
