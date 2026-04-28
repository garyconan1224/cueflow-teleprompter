from __future__ import annotations

import os
from pathlib import Path

import torch

BASE_DIR = Path(__file__).resolve().parents[2]
MODEL_CACHE_DIR = BASE_DIR / ".modelscope_cache"
LOCAL_STREAMING_MODEL_DIR = (
    MODEL_CACHE_DIR
    / "models"
    / "iic"
    / "speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-online"
)
DEFAULT_STREAMING_MODEL_ID = "paraformer-zh-streaming"

WS_PATH = "/ws/teleprompter"

SAMPLE_RATE = 16000
CHANNELS = 1
BYTES_PER_SAMPLE = 2
AUDIO_FRAME_MS = 200
PCM_FRAME_SAMPLES = SAMPLE_RATE * AUDIO_FRAME_MS // 1000
PCM_FRAME_BYTES = PCM_FRAME_SAMPLES * BYTES_PER_SAMPLE

STREAM_CHUNK_SIZE = [0, 10, 5]
ENCODER_CHUNK_LOOK_BACK = 4
DECODER_CHUNK_LOOK_BACK = 1
ASR_CHUNK_SAMPLES = STREAM_CHUNK_SIZE[1] * 960
ASR_CHUNK_BYTES = ASR_CHUNK_SAMPLES * BYTES_PER_SAMPLE

LOOKAHEAD_WINDOW = 200
MATCH_LOOKBACK = 20
RECENT_TEXT_SECONDS = 8
MATCH_THRESHOLD_PARTIAL = 68
MATCH_THRESHOLD_FINAL = 70
MIN_MATCH_CHARS_PARTIAL = 2
MIN_MATCH_CHARS_FINAL = 3
SOFT_MATCH_THRESHOLD_PARTIAL = 60
SOFT_MATCH_THRESHOLD_FINAL = 64
LOOKAHEAD_PUSH_PARTIAL = 3
LOOKAHEAD_PUSH_FINAL = 6
MONOTONIC = True
MIN_ADVANCE = 2
MAX_ADVANCE_PARTIAL = 24
MAX_ADVANCE_FINAL = 36
SOFT_MAX_ADVANCE_PARTIAL = 8
SOFT_MAX_ADVANCE_FINAL = 14
FAIL_BEFORE_EXPAND = 5
SENTENCE_ENDINGS = "。！？!?；;"

LOG_TRANSCRIPT_TEXT = True


def resolve_device() -> str:
    requested = os.getenv("TELEPROMPTER_DEVICE", "auto").strip().lower()

    if requested in {"", "auto"}:
        return "cuda:0" if torch.cuda.is_available() else "cpu"

    if requested.startswith("cuda") and not torch.cuda.is_available():
        return "cpu"

    return requested


DEFAULT_DEVICE = resolve_device()


def resolve_model_source() -> str:
    """
    Prefer the local cached model to avoid downloading on every service start.
    Fall back to the FunASR model id if the local cache does not exist yet.
    """
    if LOCAL_STREAMING_MODEL_DIR.exists():
        return str(LOCAL_STREAMING_MODEL_DIR)
    return DEFAULT_STREAMING_MODEL_ID
