import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { TeleprompterSettings } from "../types/messages";

type TeleprompterProps = {
  script: string;
  cursor: number;
  settings: TeleprompterSettings;
  title?: string;
  showFullscreenButton?: boolean;
  compactHeader?: boolean;
};

const CURRENT_WINDOW = 28;

export function Teleprompter({
  script,
  cursor,
  settings,
  title = "智能提词器调参台",
  showFullscreenButton = true,
  compactHeader = false
}: TeleprompterProps) {
  const stageRef = useRef<HTMLElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [translateY, setTranslateY] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const safeCursor = Math.max(0, Math.min(cursor, script.length));
  const before = script.slice(0, safeCursor);
  const current = script.slice(safeCursor, safeCursor + CURRENT_WINDOW) || " ";
  const after = script.slice(safeCursor + CURRENT_WINDOW);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === stageRef.current);
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    const anchor = anchorRef.current;
    if (!viewport || !content || !anchor) {
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const anchorOffset = anchorRect.top - contentRect.top;
    const target = Math.max(
      0,
      anchorOffset - viewportRect.height * settings.anchorRatio
    );
    setTranslateY(target);
  }, [
    before.length,
    current.length,
    script,
    settings.anchorRatio,
    settings.fontSize,
    settings.lineHeight,
    settings.textWidth,
    settings.letterSpacing,
    settings.viewportHeight
  ]);

  const progress = script.length > 0 ? (safeCursor / script.length) * 100 : 0;
  const fontFamily =
    settings.fontPreset === "sans"
      ? '"Aptos","Segoe UI","Microsoft YaHei",sans-serif'
      : '"Georgia","Times New Roman","SimSun",serif';

  async function toggleFullscreen() {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }

    if (document.fullscreenElement === stage) {
      await document.exitFullscreen();
      return;
    }

    await stage.requestFullscreen();
  }

  return (
    <section className="stage" ref={stageRef}>
      <div className="stage__header">
        <div>
          <p className="eyebrow">{compactHeader ? "Display" : "Preview"}</p>
          <h1>{title}</h1>
        </div>
        <div className="stage__actions">
          <div className="stage__meta">
            <span>进度 {progress.toFixed(1)}%</span>
            <span>
              游标 {safeCursor}/{script.length}
            </span>
          </div>
          {showFullscreenButton ? (
            <button className="ghost-button" type="button" onClick={toggleFullscreen}>
              {isFullscreen ? "退出全屏" : "提词器全屏"}
            </button>
          ) : null}
        </div>
      </div>

      <div
        className="teleprompter"
        ref={viewportRef}
        style={{ height: `${settings.viewportHeight}px` }}
      >
        <div
          className="teleprompter__guide"
          style={{ top: `${settings.anchorRatio * 100}%` }}
        />
        <div
          className="teleprompter__content"
          ref={contentRef}
          style={{
            transform: `translateY(-${translateY}px)`,
            transitionDuration: `${settings.transitionMs}ms`,
            fontSize: `${settings.fontSize}px`,
            lineHeight: settings.lineHeight,
            maxWidth: `${settings.textWidth}%`,
            letterSpacing: `${settings.letterSpacing}px`,
            fontFamily
          }}
        >
          {!script.trim() ? (
            <div className="teleprompter__empty">
              在左侧输入脚本，这里会实时显示提词器效果。
            </div>
          ) : (
            <p className="teleprompter__text">
              <span
                className={
                  settings.dimReadText
                    ? "teleprompter__read teleprompter__read--dim"
                    : "teleprompter__read"
                }
              >
                {before}
              </span>
              <span className="teleprompter__anchor" ref={anchorRef} />
              <span className="teleprompter__current">{current}</span>
              <span className="teleprompter__upcoming">{after}</span>
            </p>
          )}
        </div>
      </div>

      <div className="progress-bar" aria-hidden="true">
        <div className="progress-bar__fill" style={{ width: `${progress}%` }} />
      </div>
    </section>
  );
}
