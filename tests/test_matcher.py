from __future__ import annotations

import unittest

from backend.app.tracking.matcher import update_cursor


class MatcherTests(unittest.TestCase):
    def test_cursor_advances_on_match(self) -> None:
        script = "现在进入示例朗读欢迎大家来体验达摩院推出的语音识别模型后面还有一点补充内容"
        result = update_cursor(
            script=script,
            cursor=0,
            recent_text="欢迎大家来体验达摩院推出的语音识别模型",
            fail_count=0,
            is_final=True,
        )
        self.assertTrue(result.updated)
        self.assertGreater(result.position, 0)
        self.assertGreaterEqual(result.score, 70)

    def test_low_score_does_not_advance_cursor(self) -> None:
        script = "第一段内容第二段内容第三段内容"
        result = update_cursor(
            script=script,
            cursor=10,
            recent_text="完全不相关的句子",
            fail_count=0,
            is_final=False,
        )
        self.assertFalse(result.updated)
        self.assertEqual(result.position, 10)

    def test_fail_count_expands_search_window(self) -> None:
        script = "起点" + ("填充" * 80) + "目标句子在这里"
        result = update_cursor(
            script=script,
            cursor=0,
            recent_text="目标句子在这里",
            fail_count=5,
            is_final=True,
        )
        self.assertTrue(result.updated)
        self.assertGreater(result.position, 0)

    def test_partial_match_does_not_jump_to_next_sentence(self) -> None:
        script = "欢迎大家来体验达摩院推出的语音识别模型。这是下一句。"
        result = update_cursor(
            script=script,
            cursor=0,
            recent_text="欢迎大家来体验达摩院推出的语音识别模型",
            fail_count=0,
            is_final=False,
        )
        self.assertTrue(result.updated)
        self.assertLessEqual(result.position, script.index("。"))

    def test_partial_match_can_continue_after_reaching_boundary(self) -> None:
        script = "第一句结束。第二句正在继续推进。"
        boundary = script.index("。")
        result = update_cursor(
            script=script,
            cursor=boundary,
            recent_text="第二句正在继续推",
            fail_count=0,
            is_final=False,
        )
        self.assertTrue(result.updated)
        self.assertGreater(result.position, boundary)
