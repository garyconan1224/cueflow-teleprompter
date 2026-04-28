from __future__ import annotations

from dataclasses import dataclass
import re

from rapidfuzz import fuzz

from backend.app import config

_PUNCT_OR_SPACE_RE = re.compile(r"[\s\W_]+", re.UNICODE)


@dataclass(slots=True)
class CursorUpdateResult:
    position: int
    score: float
    matched: str
    fail_count: int
    updated: bool


def normalize_for_match(text: str) -> str:
    return _PUNCT_OR_SPACE_RE.sub("", text)


def update_cursor(
    *,
    script: str,
    cursor: int,
    recent_text: str,
    fail_count: int,
    is_final: bool,
) -> CursorUpdateResult:
    normalized_recent = normalize_for_match(recent_text)
    if len(normalized_recent) < 4:
        return CursorUpdateResult(
            position=cursor,
            score=0,
            matched="",
            fail_count=fail_count,
            updated=False,
        )

    window_size = config.LOOKAHEAD_WINDOW * (
        1 + fail_count // config.FAIL_BEFORE_EXPAND
    )
    window_start = max(0, cursor - config.MATCH_LOOKBACK)
    window_end = min(len(script), cursor + window_size)
    search_window = script[window_start:window_end]

    normalized_window, index_map = _normalize_with_index_map(search_window)
    if len(normalized_window) < 4:
        return CursorUpdateResult(
            position=cursor,
            score=0,
            matched=search_window,
            fail_count=fail_count + 1,
            updated=False,
        )

    result = fuzz.partial_ratio_alignment(normalized_recent, normalized_window)
    score = float(result.score)
    threshold = (
        config.MATCH_THRESHOLD_FINAL if is_final else config.MATCH_THRESHOLD_PARTIAL
    )
    if score < threshold:
        return CursorUpdateResult(
            position=cursor,
            score=score,
            matched=_safe_excerpt(search_window, result.dest_start, result.dest_end),
            fail_count=fail_count + 1,
            updated=False,
        )

    matched_end = _normalized_end_to_original_index(index_map, result.dest_end)
    match_end_position = min(len(script), window_start + matched_end)
    push = config.LOOKAHEAD_PUSH_FINAL if is_final else config.LOOKAHEAD_PUSH_PARTIAL
    new_cursor = min(len(script), match_end_position + push)
    max_advance = config.MAX_ADVANCE_FINAL if is_final else config.MAX_ADVANCE_PARTIAL
    new_cursor = min(new_cursor, cursor + max_advance)
    new_cursor = _clamp_for_sentence_boundary(
        script=script,
        cursor=cursor,
        match_end_position=match_end_position,
        proposed_cursor=new_cursor,
        is_final=is_final,
    )

    if config.MONOTONIC and new_cursor < cursor + config.MIN_ADVANCE:
        return CursorUpdateResult(
            position=cursor,
            score=score,
            matched=search_window[:matched_end],
            fail_count=fail_count,
            updated=False,
        )

    return CursorUpdateResult(
        position=new_cursor,
        score=score,
        matched=search_window[:matched_end],
        fail_count=0,
        updated=True,
    )


def _normalize_with_index_map(text: str) -> tuple[str, list[int]]:
    chars: list[str] = []
    index_map: list[int] = []

    for index, char in enumerate(text, start=1):
        if _PUNCT_OR_SPACE_RE.fullmatch(char):
            continue
        chars.append(char)
        index_map.append(index)

    return "".join(chars), index_map


def _normalized_end_to_original_index(index_map: list[int], normalized_end: int) -> int:
    if not index_map:
        return 0
    if normalized_end <= 0:
        return 0
    bounded = min(normalized_end, len(index_map))
    return index_map[bounded - 1]


def _safe_excerpt(text: str, start: int, end: int) -> str:
    if not text:
        return ""
    safe_start = max(0, min(start, len(text)))
    safe_end = max(safe_start, min(end, len(text)))
    return text[safe_start:safe_end]


def _clamp_for_sentence_boundary(
    *,
    script: str,
    cursor: int,
    match_end_position: int,
    proposed_cursor: int,
    is_final: bool,
) -> int:
    if proposed_cursor <= cursor:
        return proposed_cursor

    for index in range(cursor, min(proposed_cursor, len(script))):
        if script[index] not in config.SENTENCE_ENDINGS:
            continue

        boundary_after = index + 1
        if not is_final:
            return min(proposed_cursor, index)

        # Final results may cross the sentence end only after the match itself
        # has actually reached that boundary, not only because of lookahead push.
        if match_end_position < boundary_after:
            return min(proposed_cursor, index)

    return proposed_cursor
