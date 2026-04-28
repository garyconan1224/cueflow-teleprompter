import { expect, test } from "@playwright/test";

test("supports pasting text and wheel-based cursor nudging", async ({ page }) => {
  await page.goto("/");

  const textarea = page.getByTestId("script-input");
  await textarea.fill("第一句测试文本。\n第二句测试文本。\n第三句测试文本。");

  const progress = page.getByTestId("teleprompter-progress");
  await expect(progress).toContainText("进度 0.0%");

  const viewport = page.getByTestId("teleprompter-viewport");
  await viewport.dispatchEvent("wheel", { deltaY: 500 });

  await expect(progress).not.toContainText("进度 0.0%");
});
