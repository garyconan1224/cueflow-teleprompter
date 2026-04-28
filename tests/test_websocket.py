from __future__ import annotations

import json
import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.api.websocket import create_websocket_router
from backend.app.asr.engine import ASRChunkResult


class FakeSession:
    def __init__(self) -> None:
        self.cache: dict[str, object] = {}


class FakeEngine:
    def create_session(self) -> FakeSession:
        return FakeSession()

    async def transcribe_chunk(
        self, session: FakeSession, audio_chunk: object, *, is_final: bool
    ) -> ASRChunkResult:
        del session, audio_chunk
        text = "欢迎大家来体验" if not is_final else "达摩院推出的语音识别模型"
        return ASRChunkResult(
            text=text,
            is_final=is_final,
            latency_ms=12.3,
            raw={"text": text},
        )


class WebSocketTests(unittest.TestCase):
    def setUp(self) -> None:
        app = FastAPI()
        app.include_router(create_websocket_router(FakeEngine()))
        self.client = TestClient(app)

    def test_start_audio_stop_flow(self) -> None:
        script = "现在进入示例朗读。欢迎大家来体验达摩院推出的语音识别模型。"
        with patch("backend.app.api.websocket.AudioChunkBuffer.push", return_value=[b"frame"]), patch(
            "backend.app.api.websocket.AudioChunkBuffer.flush", return_value=[b"final"]
        ):
            with self.client.websocket_connect("/ws/teleprompter") as websocket:
                ready = websocket.receive_json()
                self.assertEqual(ready["type"], "status")
                self.assertEqual(ready["state"], "ready")

                websocket.send_text(json.dumps({"type": "start", "script": script}))
                listening = websocket.receive_json()
                self.assertEqual(listening["state"], "listening")

                initial_cursor = websocket.receive_json()
                self.assertEqual(initial_cursor["type"], "cursor")
                self.assertFalse(initial_cursor["lost"])

                websocket.send_bytes(b"\x00\x01")
                transcript = websocket.receive_json()
                self.assertEqual(transcript["type"], "transcript")
                self.assertFalse(transcript["is_final"])

                cursor = websocket.receive_json()
                self.assertEqual(cursor["type"], "cursor")
                self.assertIn("lost", cursor)

                websocket.send_text(json.dumps({"type": "stop"}))
                final_transcript = websocket.receive_json()
                self.assertEqual(final_transcript["type"], "transcript")
                self.assertTrue(final_transcript["is_final"])

                final_cursor = websocket.receive_json()
                self.assertEqual(final_cursor["type"], "cursor")

                stopped = websocket.receive_json()
                self.assertEqual(stopped["type"], "status")
                self.assertEqual(stopped["state"], "stopped")
