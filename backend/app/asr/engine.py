from __future__ import annotations

import asyncio
import logging
import os
import threading
import time
from dataclasses import dataclass, field
from typing import Any

from funasr import AutoModel

from backend.app import config

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class ASRChunkResult:
    text: str
    is_final: bool
    latency_ms: float
    raw: Any


@dataclass(slots=True)
class ASRSessionState:
    cache: dict[str, Any] = field(default_factory=dict)


class StreamingASREngine:
    """
    一期方案共享一个全局模型实例，避免多连接重复占用显存。
    每个连接只保留自己的 cache，从而保证流式上下文彼此独立。
    """

    def __init__(self) -> None:
        self._model: Any | None = None
        self._model_lock = threading.Lock()
        self._infer_lock = threading.Lock()

    async def warmup(self) -> None:
        await asyncio.to_thread(self._ensure_model)

    def create_session(self) -> ASRSessionState:
        return ASRSessionState()

    async def transcribe_chunk(
        self,
        session: ASRSessionState,
        audio_chunk: Any,
        *,
        is_final: bool,
    ) -> ASRChunkResult:
        return await asyncio.to_thread(
            self._transcribe_chunk_sync,
            session,
            audio_chunk,
            is_final,
        )

    def _ensure_model(self) -> Any:
        if self._model is not None:
            return self._model

        with self._model_lock:
            if self._model is not None:
                return self._model

            config.MODEL_CACHE_DIR.mkdir(parents=True, exist_ok=True)
            os.environ["MODELSCOPE_CACHE"] = str(config.MODEL_CACHE_DIR)
            os.environ.setdefault("HF_HOME", str(config.MODEL_CACHE_DIR / "hf"))

            model_source = config.resolve_model_source()
            logger.info("Loading FunASR streaming model from %s", model_source)
            self._model = AutoModel(
                model=model_source,
                device=config.DEFAULT_DEVICE,
                disable_update=True,
            )
            logger.info("FunASR model loaded on %s", config.DEFAULT_DEVICE)
            return self._model

    def _transcribe_chunk_sync(
        self,
        session: ASRSessionState,
        audio_chunk: Any,
        is_final: bool,
    ) -> ASRChunkResult:
        model = self._ensure_model()

        started_at = time.perf_counter()
        # 共享一个模型实例时，这里串行调用更稳，避免底层状态竞争。
        with self._infer_lock:
            raw_result = model.generate(
                input=audio_chunk,
                cache=session.cache,
                is_final=is_final,
                chunk_size=config.STREAM_CHUNK_SIZE,
                encoder_chunk_look_back=config.ENCODER_CHUNK_LOOK_BACK,
                decoder_chunk_look_back=config.DECODER_CHUNK_LOOK_BACK,
            )
        latency_ms = (time.perf_counter() - started_at) * 1000
        text = self._extract_text(raw_result)

        if text:
            logger.info(
                "ASR chunk done: latency=%.1fms, final=%s, text=%s",
                latency_ms,
                is_final,
                text,
            )
        else:
            logger.debug(
                "ASR chunk done: latency=%.1fms, final=%s, text=<empty>",
                latency_ms,
                is_final,
            )

        return ASRChunkResult(
            text=text,
            is_final=is_final,
            latency_ms=latency_ms,
            raw=raw_result,
        )

    @staticmethod
    def _extract_text(raw_result: Any) -> str:
        if not raw_result:
            return ""
        if isinstance(raw_result, dict):
            return str(raw_result.get("text", "")).strip()
        if isinstance(raw_result, list):
            texts: list[str] = []
            for item in raw_result:
                if isinstance(item, dict):
                    text = str(item.get("text", "")).strip()
                    if text:
                        texts.append(text)
            return " ".join(texts).strip()
        return str(raw_result).strip()
