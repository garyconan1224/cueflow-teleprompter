from __future__ import annotations

import logging

from fastapi import FastAPI

from backend.app.api.websocket import create_websocket_router
from backend.app.asr.engine import StreamingASREngine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)

app = FastAPI(title="Voice Teleprompter Backend", version="0.2.0")
engine = StreamingASREngine()
app.include_router(create_websocket_router(engine))


@app.on_event("startup")
async def on_startup() -> None:
    await engine.warmup()


@app.get("/health")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
