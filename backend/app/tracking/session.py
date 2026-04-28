from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
import time

from backend.app import config
from backend.app.tracking.matcher import CursorUpdateResult, update_cursor


@dataclass(slots=True)
class TranscriptChunk:
    text: str
    timestamp: float
    is_final: bool


@dataclass(slots=True)
class TrackingSession:
    script: str = ""
    cursor: int = 0
    fail_count: int = 0
    recent_chunks: deque[TranscriptChunk] = field(default_factory=deque)
    last_score: float = 0
    last_matched: str = ""
    is_tracking: bool = False

    def start(self, script: str) -> None:
        self.script = script
        self.cursor = 0
        self.fail_count = 0
        self.recent_chunks.clear()
        self.last_score = 0
        self.last_matched = ""
        self.is_tracking = True

    def stop(self) -> None:
        self.is_tracking = False

    def reset(self) -> None:
        self.start(self.script)

    def seek(self, cursor: int) -> int:
        self.cursor = max(0, min(cursor, len(self.script)))
        self.fail_count = 0
        self.recent_chunks.clear()
        self.last_score = 0
        self.last_matched = ""
        return self.cursor

    def add_transcript(self, text: str, *, is_final: bool) -> CursorUpdateResult | None:
        if not self.is_tracking or not self.script or not text.strip():
            return None

        now = time.monotonic()
        self._append_chunk(text.strip(), now=now, is_final=is_final)
        self._drop_expired(now)

        recent_text = "".join(chunk.text for chunk in self.recent_chunks).strip()
        result = update_cursor(
            script=self.script,
            cursor=self.cursor,
            recent_text=recent_text,
            fail_count=self.fail_count,
            is_final=is_final,
        )
        self.fail_count = result.fail_count
        self.last_score = result.score
        self.last_matched = result.matched
        if result.updated:
            self.cursor = result.position
            self._shrink_after_success()
        return result

    def _append_chunk(self, text: str, *, now: float, is_final: bool) -> None:
        if not self.recent_chunks:
            self.recent_chunks.append(TranscriptChunk(text=text, timestamp=now, is_final=is_final))
            return

        last = self.recent_chunks[-1]
        if text == last.text:
            last.timestamp = now
            last.is_final = is_final
            return

        if not is_final and (text.startswith(last.text) or last.text.startswith(text)):
            better_text = text if len(text) >= len(last.text) else last.text
            self.recent_chunks[-1] = TranscriptChunk(
                text=better_text,
                timestamp=now,
                is_final=is_final or last.is_final,
            )
            return

        self.recent_chunks.append(TranscriptChunk(text=text, timestamp=now, is_final=is_final))

    def _drop_expired(self, now: float) -> None:
        cutoff = now - config.RECENT_TEXT_SECONDS
        while self.recent_chunks and self.recent_chunks[0].timestamp < cutoff:
            self.recent_chunks.popleft()

    def _shrink_after_success(self) -> None:
        while len(self.recent_chunks) > 1:
            self.recent_chunks.popleft()
