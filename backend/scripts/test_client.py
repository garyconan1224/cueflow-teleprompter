from __future__ import annotations

import argparse
import asyncio
import contextlib
import json
import sys
import time
import wave
from pathlib import Path

import websockets

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.app import config

DEFAULT_WAV_PATH = (
    config.LOCAL_STREAMING_MODEL_DIR / "example" / "asr_example.wav"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Phase 2 WebSocket ASR test client")
    parser.add_argument(
        "--ws-url",
        default="ws://127.0.0.1:8000/ws/teleprompter",
        help="后端 WebSocket 地址",
    )
    parser.add_argument(
        "--wav",
        default=str(DEFAULT_WAV_PATH),
        help="16kHz 单声道 16-bit PCM wav 文件路径",
    )
    parser.add_argument(
        "--realtime",
        action="store_true",
        help="按实时速度发送音频，而不是一次性打满",
    )
    return parser.parse_args()


async def receive_messages(ws: websockets.WebSocketClientProtocol) -> None:
    async for message in ws:
        try:
            payload = json.loads(message)
        except json.JSONDecodeError:
            print("[server] 非 JSON 消息:", message)
            continue
        print("[server]", json.dumps(payload, ensure_ascii=False))


def iter_pcm_chunks(wav_path: Path) -> list[bytes]:
    with wave.open(str(wav_path), "rb") as wav_file:
        if wav_file.getframerate() != config.SAMPLE_RATE:
            raise ValueError("wav 采样率必须是 16000 Hz")
        if wav_file.getnchannels() != config.CHANNELS:
            raise ValueError("wav 必须是单声道")
        if wav_file.getsampwidth() != config.BYTES_PER_SAMPLE:
            raise ValueError("wav 必须是 16-bit PCM")

        chunks: list[bytes] = []
        while True:
            pcm = wav_file.readframes(config.PCM_FRAME_SAMPLES)
            if not pcm:
                break
            chunks.append(pcm)
        return chunks


async def main() -> int:
    args = parse_args()
    wav_path = Path(args.wav).resolve()
    if not wav_path.exists():
        raise SystemExit(f"找不到 wav 文件: {wav_path}")

    chunks = iter_pcm_chunks(wav_path)
    print(f"准备发送 {len(chunks)} 个音频块，文件: {wav_path}")

    async with websockets.connect(args.ws_url, max_size=2**22) as ws:
        receiver = asyncio.create_task(receive_messages(ws))

        await ws.send(
            json.dumps(
                {
                    "type": "start",
                    "script": "Phase 2 test client script placeholder",
                },
                ensure_ascii=False,
            )
        )

        for index, chunk in enumerate(chunks, start=1):
            started_at = time.perf_counter()
            await ws.send(chunk)
            print(f"[client] sent chunk {index}/{len(chunks)} ({len(chunk)} bytes)")
            if args.realtime:
                spent = time.perf_counter() - started_at
                await asyncio.sleep(max(0, config.AUDIO_FRAME_MS / 1000 - spent))

        await ws.send(json.dumps({"type": "stop"}, ensure_ascii=False))
        await asyncio.sleep(1.0)
        receiver.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await receiver

    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
