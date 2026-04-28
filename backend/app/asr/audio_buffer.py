from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from backend.app import config


def pcm16le_bytes_to_float32(audio_bytes: bytes) -> np.ndarray:
    """
    把浏览器 / 测试客户端送来的 Int16 little-endian PCM 转成 float32。
    FunASR 在我们现有验证脚本里就是按 float32 波形输入的，这里保持一致。
    """
    if len(audio_bytes) % config.BYTES_PER_SAMPLE != 0:
        raise ValueError("PCM 字节长度不是 16-bit 样本边界，无法解析")

    int16_audio = np.frombuffer(audio_bytes, dtype="<i2")
    return int16_audio.astype(np.float32) / 32768.0


@dataclass(slots=True)
class AudioChunkBuffer:
    frame_bytes: int = config.ASR_CHUNK_BYTES
    _buffer: bytearray = field(default_factory=bytearray)

    def push(self, audio_bytes: bytes) -> list[np.ndarray]:
        """
        收到任意长度的二进制帧后，按 FunASR 实际推理块切分。
        上游仍然可以按 200ms 发送；这里只负责攒成模型更稳定的 600ms 输入。
        """
        self._buffer.extend(audio_bytes)
        frames: list[np.ndarray] = []

        while len(self._buffer) >= self.frame_bytes:
            frame = bytes(self._buffer[: self.frame_bytes])
            del self._buffer[: self.frame_bytes]
            frames.append(pcm16le_bytes_to_float32(frame))

        return frames

    def flush(self) -> list[np.ndarray]:
        """
        会话结束时把剩余不足 200ms 的尾巴补零后再送一次，尽量别丢最后一句。
        """
        if not self._buffer:
            return []

        padded = bytes(self._buffer) + b"\x00" * (self.frame_bytes - len(self._buffer))
        self._buffer.clear()
        return [pcm16le_bytes_to_float32(padded)]

    def clear(self) -> None:
        self._buffer.clear()
