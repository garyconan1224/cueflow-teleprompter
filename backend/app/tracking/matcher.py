from __future__ import annotations

from dataclasses import dataclass
import re

from pypinyin import Style, lazy_pinyin
from rapidfuzz import fuzz

from backend.app import config

_PUNCT_OR_SPACE_RE = re.compile(r"[\s\W_]+", re.UNICODE)
_CJK_RE = re.compile(r"[\u4e00-\u9fff]")


@dataclass(slots=True)
class CursorUpdateResult:
    position: int
    score: float
    matched: str
    fail_count: int
    updated: bool


@dataclass(slots=True)
class AlignmentCandidate:
    score: float
    dest_start: int
    dest_end: int
    index_map: list[int]


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
    min_match_chars = (
        config.MIN_MATCH_CHARS_FINAL if is_final else config.MIN_MATCH_CHARS_PARTIAL
    )
    if len(normalized_recent) < min_match_chars:
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
    if len(normalized_window) < min_match_chars:
        return CursorUpdateResult(
            position=cursor,
            score=0,
            matched=search_window,
            fail_count=fail_count + 1,
            updated=False,
        )

    if len(normalized_recent) < 4:
        short_result = _match_short_text(
            script=script,
            cursor=cursor,
            window_start=window_start,
            search_window=search_window,
            normalized_recent=normalized_recent,
            normalized_window=normalized_window,
            index_map=index_map,
            is_final=is_final,
        )
        if short_result is not None:
            return short_result
        return CursorUpdateResult(
            position=cursor,
            score=0,
            matched="",
            fail_count=fail_count + 1,
            updated=False,
        )

    result = _best_alignment(
        recent_text=recent_text,
        normalized_recent=normalized_recent,
        search_window=search_window,
        normalized_window=normalized_window,
        index_map=index_map,
    )
    score = result.score
    threshold = (
        config.MATCH_THRESHOLD_FINAL if is_final else config.MATCH_THRESHOLD_PARTIAL
    )
    if score < threshold:
        soft_threshold = (
            config.SOFT_MATCH_THRESHOLD_FINAL
            if is_final
            else config.SOFT_MATCH_THRESHOLD_PARTIAL
        )
        if score >= soft_threshold:
            soft_result = _build_cursor_result(
                script=script,
                cursor=cursor,
                window_start=window_start,
                search_window=search_window,
                index_map=result.index_map,
                normalized_end=result.dest_end,
                score=score,
                fail_count=fail_count,
                is_final=is_final,
                soft=True,
            )
            if soft_result.updated:
                return soft_result
        return CursorUpdateResult(
            position=cursor,
            score=score,
            matched=_safe_excerpt(search_window, result.dest_start, result.dest_end),
            fail_count=fail_count + 1,
            updated=False,
        )

    return _build_cursor_result(
        script=script,
        cursor=cursor,
        window_start=window_start,
        search_window=search_window,
        index_map=result.index_map,
        normalized_end=result.dest_end,
        score=score,
        fail_count=fail_count,
        is_final=is_final,
        soft=False,
    )


def _best_alignment(
    *,
    recent_text: str,
    normalized_recent: str,
    search_window: str,
    normalized_window: str,
    index_map: list[int],
) -> AlignmentCandidate:
    text_result = fuzz.partial_ratio_alignment(normalized_recent, normalized_window)
    best = AlignmentCandidate(
        score=float(text_result.score),
        dest_start=text_result.dest_start,
        dest_end=text_result.dest_end,
        index_map=index_map,
    )

    recent_pinyin = _normalize_to_pinyin(recent_text)
    window_pinyin, pinyin_index_map = _pinyin_with_index_map(search_window)
    if len(recent_pinyin) < 4 or len(window_pinyin) < 4:
        return best

    pinyin_result = fuzz.partial_ratio_alignment(recent_pinyin, window_pinyin)
    pinyin_score = max(0.0, float(pinyin_result.score) - 4.0)
    if pinyin_score > best.score:
        return AlignmentCandidate(
            score=pinyin_score,
            dest_start=pinyin_result.dest_start,
            dest_end=pinyin_result.dest_end,
            index_map=pinyin_index_map,
        )

    return best


def _match_short_text(
    *,
    script: str,
    cursor: int,
    window_start: int,
    search_window: str,
    normalized_recent: str,
    normalized_window: str,
    index_map: list[int],
    is_final: bool,
) -> CursorUpdateResult | None:
    start = normalized_window.find(normalized_recent)
    if start < 0:
        return None

    return _build_cursor_result(
        script=script,
        cursor=cursor,
        window_start=window_start,
        search_window=search_window,
        index_map=index_map,
        normalized_end=start + len(normalized_recent),
        score=100,
        fail_count=0,
        is_final=is_final,
        soft=False,
    )


def _build_cursor_result(
    *,
    script: str,
    cursor: int,
    window_start: int,
    search_window: str,
    index_map: list[int],
    normalized_end: int,
    score: float,
    fail_count: int,
    is_final: bool,
    soft: bool,
) -> CursorUpdateResult:
    matched_end = _normalized_end_to_original_index(index_map, normalized_end)
    match_end_position = min(len(script), window_start + matched_end)
    push = config.LOOKAHEAD_PUSH_FINAL if is_final else config.LOOKAHEAD_PUSH_PARTIAL
    if soft:
        push = 0
    new_cursor = min(len(script), match_end_position + push)
    if soft:
        max_advance = (
            config.SOFT_MAX_ADVANCE_FINAL
            if is_final
            else config.SOFT_MAX_ADVANCE_PARTIAL
        )
    else:
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


def _normalize_to_pinyin(text: str) -> str:
    normalized_parts: list[str] = []
    for char in text:
        if _PUNCT_OR_SPACE_RE.fullmatch(char):
            continue
        if _CJK_RE.fullmatch(char):
            normalized_parts.append(lazy_pinyin(char, style=Style.NORMAL)[0])
        else:
            normalized_parts.append(char.lower())
    return "".join(normalized_parts)


def _pinyin_with_index_map(text: str) -> tuple[str, list[int]]:
    chars: list[str] = []
    index_map: list[int] = []

    for index, char in enumerate(text, start=1):
        if _PUNCT_OR_SPACE_RE.fullmatch(char):
            continue
        if _CJK_RE.fullmatch(char):
            token = lazy_pinyin(char, style=Style.NORMAL)[0]
        else:
            token = char.lower()
        chars.append(token)
        index_map.extend([index] * len(token))

    return "".join(chars), index_map


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

    current = _skip_consumed_boundaries(script, cursor)
    if proposed_cursor <= current:
        return proposed_cursor

    for index in range(current, min(proposed_cursor, len(script))):
        if script[index] not in config.SENTENCE_ENDINGS:
            continue

        boundary_after = index + 1
        if not is_final and cursor < index and match_end_position < boundary_after:
            return index

        if is_final and match_end_position < boundary_after:
            return index

    return proposed_cursor


def _skip_consumed_boundaries(script: str, cursor: int) -> int:
    index = max(0, min(cursor, len(script)))
    while index < len(script) and script[index] in config.SENTENCE_ENDINGS:
        index += 1
    return index
