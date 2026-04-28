import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, WheelEvent } from "react";
import type { TeleprompterSettings } from "../types/messages";

type TeleprompterProps = {
  script: string;
  cursor: number;
  scrollCursor?: number;
  settings: TeleprompterSettings;
  title?: string;
  showFullscreenButton?: boolean;
  compactHeader?: boolean;
  onCursorNudge?: (delta: number) => void;
};

const CURRENT_WINDOW_SIZE = 18;
const SENTENCE_ENDINGS = /[。！？；!?;,，]/;

function splitScriptWindow(script: string, cursor: number) {
  const safeCursor = Math.max(0, Math.min(cursor, script.length));
  const before = script.slice(0, safeCursor);
  const upcoming = script.slice(safeCursor);
  const sentenceBreakIndex = upcoming
    .slice(0, CURRENT_WINDOW_SIZE + 12)
    .search(SENTENCE_ENDINGS);
  const currentLength =
    sentenceBreakIndex >= 0
      ? Math.max(1, Math.min(sentenceBreakIndex + 1, CURRENT_WINDOW_SIZE + 6))
      : Math.min(CURRENT_WINDOW_SIZE, upcoming.length);

  return {
    before,
    current: upcoming.slice(0, currentLength),
    after: upcoming.slice(currentLength)
  };
}

export function Teleprompter({
  script,
  cursor,
  scrollCursor,
  settings,
  title = "智能提词器",
  showFullscreenButton = true,
  compactHeader = false,
  onCursorNudge
}: TeleprompterProps) {
  const stageRef = useRef<HTMLElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [translateY, setTranslateY] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const safeCursor = Math.max(0, Math.min(cursor, script.length));
  const safeScrollCursor = Math.max(
    0,
    Math.min(scrollCursor ?? safeCursor, script.length)
  );
  const { before, current, after } = splitScriptWindow(script, safeCursor);

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
    safeScrollCursor,
    script,
    settings.anchorRatio,
    settings.fontSize,
    settings.lineHeight,
    settings.textWidth,
    settings.letterSpacing,
    settings.viewportHeight,
    isFullscreen,
    compactHeader
  ]);

  const progress = script.length > 0 ? (safeCursor / script.length) * 100 : 0;
  const fontFamily =
    settings.fontPreset === "sans"
      ? '"Aptos","Segoe UI","Microsoft YaHei",sans-serif'
      : '"Georgia","Times New Roman","SimSun",serif';

  const viewportStyle = useMemo<CSSProperties>(() => {
    if (isFullscreen || compactHeader) {
      return {
        flex: 1,
        minHeight: 0
      };
    }

    return {
      height: `min(${settings.viewportHeight}vh, calc(100vh - 180px))`
    };
  }, [compactHeader, isFullscreen, settings.viewportHeight]);

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

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    if (!onCursorNudge || !script.length) {
      return;
    }

    event.preventDefault();
    const direction = event.deltaY > 0 ? 1 : -1;
    const step = event.shiftKey ? 24 : 8;
    onCursorNudge(direction * step);
  }

  return (
    <section
      className="stage"
      ref={stageRef}
      data-testid={compactHeader ? "display-teleprompter" : "teleprompter-stage"}
    >
      <div className="stage__header">
        <div>
          <p className="eyebrow">{compactHeader ? "Display" : "Preview"}</p>
          <h1>{title}</h1>
        </div>
        <div className="stage__actions">
          <div className="stage__meta">
            <span data-testid="teleprompter-progress">进度 {progress.toFixed(1)}%</span>
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
        style={viewportStyle}
        onWheel={handleWheel}
        data-testid="teleprompter-viewport"
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
            transitionDuration: `${Math.min(settings.transitionMs, 240)}ms`,
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
            <>
              <p className="teleprompter__measure" aria-hidden="true">
                <span>{script.slice(0, safeScrollCursor)}</span>
                <span className="teleprompter__anchor" ref={anchorRef} />
                <span>{script.slice(safeScrollCursor)}</span>
              </p>
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
                <span className="teleprompter__current">{current}</span>
                <span className="teleprompter__upcoming">{after}</span>
              </p>
            </>
          )}
        </div>
      </div>

      <div className="meta-row teleprompter__hint">
        <span>鼠标滚轮可微调位置，按住 Shift 可大步调整。</span>
        <span>滚动会平滑追赶，高亮会优先跟上你的朗读位置。</span>
      </div>

      <div className="progress-bar" aria-hidden="true">
        <div className="progress-bar__fill" style={{ width: `${progress}%` }} />
      </div>
    </section>
  );
}
