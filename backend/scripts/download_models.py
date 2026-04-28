from __future__ import annotations

import asyncio
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.app import config
from backend.app.asr.engine import StreamingASREngine


async def main() -> int:
    engine = StreamingASREngine()
    await engine.warmup()
    print("FunASR model is ready.")
    print(f"Model source: {config.resolve_model_source()}")
    print(f"Cache dir: {config.MODEL_CACHE_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
