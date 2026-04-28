from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.app import config
from backend.app.asr.audio_buffer import AudioChunkBuffer
from backend.app.asr.engine import ASRSessionState, StreamingASREngine
from backend.app.tracking.session import TrackingSession

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class ConnectionRuntimeState:
    started: bool = False


def create_websocket_router(engine: StreamingASREngine) -> APIRouter:
    router = APIRouter()

    @router.websocket(config.WS_PATH)
    async def teleprompter_websocket(websocket: WebSocket) -> None:
        await websocket.accept()
        logger.info("WebSocket connected from %s", websocket.client)

        audio_buffer = AudioChunkBuffer()
        asr_session = engine.create_session()
        runtime = ConnectionRuntimeState()
        tracking_session = TrackingSession()

        await websocket.send_json({"type": "status", "state": "ready"})

        try:
            while True:
                message = await websocket.receive()

                if message["type"] == "websocket.disconnect":
                    break

                if audio_bytes := message.get("bytes"):
                    await _handle_audio_bytes(
                        websocket=websocket,
                        engine=engine,
                        asr_session=asr_session,
                        audio_buffer=audio_buffer,
                        audio_bytes=audio_bytes,
                        runtime=runtime,
                        tracking_session=tracking_session,
                    )
                    continue

                if text_payload := message.get("text"):
                    await _handle_control_message(
                        websocket=websocket,
                        payload=text_payload,
                        runtime=runtime,
                        engine=engine,
                        asr_session=asr_session,
                        audio_buffer=audio_buffer,
                        tracking_session=tracking_session,
                    )
        except WebSocketDisconnect:
            logger.info("WebSocket disconnected from %s", websocket.client)
        except Exception:
            logger.exception("Unexpected WebSocket error")
            await _safe_send_json(
                websocket,
                {"type": "error", "message": "服务端处理音频时发生异常"},
            )
        finally:
            await _flush_tail_audio(
                websocket=websocket,
                engine=engine,
                asr_session=asr_session,
                audio_buffer=audio_buffer,
                runtime=runtime,
                tracking_session=tracking_session,
            )
            logger.info("WebSocket cleanup finished for %s", websocket.client)

    return router


async def _handle_control_message(
    *,
    websocket: WebSocket,
    payload: str,
    runtime: ConnectionRuntimeState,
    engine: StreamingASREngine,
    asr_session: ASRSessionState,
    audio_buffer: AudioChunkBuffer,
    tracking_session: TrackingSession,
) -> None:
    try:
        message = json.loads(payload)
    except json.JSONDecodeError:
        await websocket.send_json({"type": "error", "message": "控制消息不是合法 JSON"})
        return

    message_type = message.get("type")

    if message_type == "start":
        script = str(message.get("script", ""))
        asr_session.cache.clear()
        audio_buffer.clear()
        tracking_session.start(script)
        runtime.started = True
        await websocket.send_json({"type": "status", "state": "listening"})
        await _safe_send_json(websocket, _cursor_payload(tracking_session.cursor, 0, ""))
        return

    if message_type == "stop":
        await _flush_tail_audio(
            websocket=websocket,
            engine=engine,
            asr_session=asr_session,
            audio_buffer=audio_buffer,
            runtime=runtime,
            tracking_session=tracking_session,
        )
        runtime.started = False
        tracking_session.stop()
        return

    if message_type == "reset":
        asr_session.cache.clear()
        audio_buffer.clear()
        tracking_session.reset()
        tracking_session.stop()
        runtime.started = False
        await websocket.send_json({"type": "status", "state": "ready"})
        await _safe_send_json(websocket, _cursor_payload(tracking_session.cursor, 0, ""))
        return

    if message_type == "seek":
        seek_position = int(message.get("cursor", 0))
        new_cursor = tracking_session.seek(seek_position)
        await _safe_send_json(websocket, _cursor_payload(new_cursor, 0, ""))
        return

    await websocket.send_json(
        {"type": "error", "message": f"未知控制消息类型: {message_type}"}
    )


async def _handle_audio_bytes(
    *,
    websocket: WebSocket,
    engine: StreamingASREngine,
    asr_session: ASRSessionState,
    audio_buffer: AudioChunkBuffer,
    audio_bytes: bytes,
    runtime: ConnectionRuntimeState,
    tracking_session: TrackingSession,
) -> None:
    if not runtime.started:
        runtime.started = True
        await websocket.send_json({"type": "status", "state": "listening"})

    frames = audio_buffer.push(audio_bytes)
    for frame in frames:
        result = await engine.transcribe_chunk(asr_session, frame, is_final=False)
        if result.text:
            await websocket.send_json(
                {
                    "type": "transcript",
                    "text": result.text,
                    "is_final": False,
                    "latency_ms": round(result.latency_ms, 1),
                }
            )
            cursor_result = tracking_session.add_transcript(result.text, is_final=False)
            if cursor_result is not None:
                await _safe_send_json(
                    websocket,
                    _cursor_payload(
                        cursor_result.position,
                        cursor_result.score,
                        cursor_result.matched,
                    ),
                )


async def _flush_tail_audio(
    *,
    websocket: WebSocket,
    engine: StreamingASREngine,
    asr_session: ASRSessionState,
    audio_buffer: AudioChunkBuffer,
    runtime: ConnectionRuntimeState,
    tracking_session: TrackingSession,
) -> None:
    if not runtime.started:
        return

    for frame in audio_buffer.flush():
        result = await engine.transcribe_chunk(asr_session, frame, is_final=True)
        if result.text:
            await _safe_send_json(
                websocket,
                {
                    "type": "transcript",
                    "text": result.text,
                    "is_final": True,
                    "latency_ms": round(result.latency_ms, 1),
                },
            )
            cursor_result = tracking_session.add_transcript(result.text, is_final=True)
            if cursor_result is not None:
                await _safe_send_json(
                    websocket,
                    _cursor_payload(
                        cursor_result.position,
                        cursor_result.score,
                        cursor_result.matched,
                    ),
                )

    await _safe_send_json(websocket, {"type": "status", "state": "stopped"})


def _cursor_payload(position: int, score: float, matched: str) -> dict[str, Any]:
    return {
        "type": "cursor",
        "position": position,
        "score": round(score, 1),
        "matched": matched,
    }


async def _safe_send_json(websocket: WebSocket, payload: dict[str, Any]) -> None:
    try:
        await websocket.send_json(payload)
    except RuntimeError:
        pass
    except WebSocketDisconnect:
        pass
