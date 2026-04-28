import type { BackendState } from "../types/messages";
import type { WSConnectionState } from "../hooks/useTeleprompterWS";

type ConnectionPanelProps = {
  wsUrl: string;
  wsConnectionState: WSConnectionState;
  backendState: BackendState | null;
  isCapturing: boolean;
  transcript: string;
  latencyMs: number | null;
  error: string | null;
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

export function ConnectionPanel({
  wsUrl,
  wsConnectionState,
  backendState,
  isCapturing,
  transcript,
  latencyMs,
  error,
  onWsUrlChange,
  onConnect,
  onDisconnect,
  onSyncScript,
  onStartMic,
  onStopMic,
  onClearTranscript
}: ConnectionPanelProps) {
  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Live Link</p>
          <h2>后端识别链路</h2>
        </div>
        <span className="status-pill">
          {renderStateLabel(wsConnectionState, backendState)}
        </span>
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
        <span>
          最近延迟: {latencyMs !== null ? `${latencyMs.toFixed(1)} ms` : "暂无"}
        </span>
      </div>

      <div className="transcript-box">
        {transcript || "这里会显示后端返回的实时识别文本。"}
      </div>

      {error ? <p className="error-text">{error}</p> : null}
    </section>
  );
}
