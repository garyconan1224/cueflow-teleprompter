import { useState } from "react";
import type { WSConnectionState } from "../hooks/useTeleprompterWS";
import type { AppMode, BackendState } from "../types/messages";

type ConnectionPanelProps = {
  wsUrl: string;
  wsConnectionState: WSConnectionState;
  backendState: BackendState | null;
  appMode: AppMode;
  isCapturing: boolean;
  transcript: string;
  latencyMs: number | null;
  cursorPosition: number | null;
  matchScore: number | null;
  matchedText: string;
  isCursorLost: boolean;
  error: string | null;
  defaultExpanded?: boolean;
  onWsUrlChange: (value: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onSyncScript: () => void;
  onStartMic: () => void;
  onStopMic: () => void;
  onClearTranscript: () => void;
};

function renderStateLabel(
  wsConnectionState: WSConnectionState,
  backendState: BackendState | null
) {
  if (wsConnectionState === "connecting") {
    return "连接中";
  }
  if (wsConnectionState === "connected") {
    return `已连接 / ${backendState ?? "等待状态"}`;
  }
  if (wsConnectionState === "error") {
    return "连接异常";
  }
  return "未连接";
}

function renderModeLabel(appMode: AppMode) {
  switch (appMode) {
    case "connecting":
      return "正在连接后端";
    case "ready":
      return "已连接，等待开始识别";
    case "listening":
      return "正在根据声音驱动提词";
    case "paused":
      return "麦克风已暂停";
    case "error":
      return "当前有错误，请先处理";
    default:
      return "尚未连接识别服务";
  }
}

export function ConnectionPanel({
  wsUrl,
  wsConnectionState,
  backendState,
  appMode,
  isCapturing,
  transcript,
  latencyMs,
  cursorPosition,
  matchScore,
  matchedText,
  isCursorLost,
  error,
  defaultExpanded = false,
  onWsUrlChange,
  onConnect,
  onDisconnect,
  onSyncScript,
  onStartMic,
  onStopMic,
  onClearTranscript
}: ConnectionPanelProps) {
  const [collapsed, setCollapsed] = useState(!defaultExpanded);
  return (
    <section className={`panel${" panel--collapsible"}`}>
      <div className="panel__header">
        <div
          onClick={() => setCollapsed((v) => !v)}
        >
          <p className="eyebrow">Live Link</p>
          <h2>
            后端识别链路
            <span
              className={`panel__collapse-icon${collapsed ? " panel__collapse-icon--collapsed" : ""}`}
            >
              ▾
            </span>
          </h2>
        </div>
        <span className="status-pill">
          {renderStateLabel(wsConnectionState, backendState)}
        </span>
      </div>

      <div
        className={`panel__body${collapsed ? " panel__body--collapsed" : ""}`}
      >

      <div className="meta-row meta-row--banner">
        <span>工作状态</span>
        <strong>{renderModeLabel(appMode)}</strong>
      </div>

      <label className="field">
        <span className="field__label">WebSocket 地址</span>
        <input
          className="text-input"
          value={wsUrl}
          onChange={(event) => onWsUrlChange(event.target.value)}
          placeholder="ws://127.0.0.1:8000/ws/teleprompter"
        />
      </label>

      <div className="button-row">
        <button className="primary-button" onClick={onConnect} type="button">
          连接后端
        </button>
        <button className="ghost-button" onClick={onDisconnect} type="button">
          断开连接
        </button>
        <button className="ghost-button" onClick={onSyncScript} type="button">
          同步脚本
        </button>
      </div>

      <div className="button-row">
        <button className="primary-button" onClick={onStartMic} type="button">
          开始麦克风识别
        </button>
        <button className="ghost-button" onClick={onStopMic} type="button">
          停止麦克风
        </button>
        <button className="ghost-button" onClick={onClearTranscript} type="button">
          清空转写
        </button>
      </div>

      <div className="meta-row">
        <span>采音状态: {isCapturing ? "采集中" : "未采集"}</span>
        <span>最近延迟: {latencyMs !== null ? `${latencyMs.toFixed(1)} ms` : "暂无"}</span>
      </div>

      <div className="meta-row">
        <span>实时游标: {cursorPosition ?? 0}</span>
        <span>匹配分数: {matchScore !== null ? matchScore.toFixed(1) : "暂无"}</span>
      </div>

      {isCursorLost ? (
        <p className="warning-text">
          跟读位置暂时丢失，可以拖动当前位置或滚动提词器重新对齐。
        </p>
      ) : null}

      <div className="transcript-box">
        {transcript || "这里会显示后端返回的实时识别文本。"}
      </div>

      <div className="debug-box">
        {matchedText || "这里会显示最近一次用于推进游标的匹配片段。"}
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      </div>
    </section>
  );
}
