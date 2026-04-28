import { useEffect, useMemo, useState } from "react";
import { ConnectionPanel } from "./components/ConnectionPanel";
import { ControlPanel } from "./components/ControlPanel";
import { ScriptEditor } from "./components/ScriptEditor";
import { Teleprompter } from "./components/Teleprompter";
import { useAudioCapture } from "./hooks/useAudioCapture";
import { useTeleprompterWS } from "./hooks/useTeleprompterWS";
import type { TeleprompterSettings } from "./types/messages";
import { sampleScript } from "./utils/sampleScript";

const SETTINGS_STORAGE_KEY = "voice-teleprompter:settings";
const SCRIPT_STORAGE_KEY = "voice-teleprompter:script";
const WS_URL_STORAGE_KEY = "voice-teleprompter:ws-url";

const defaultSettings: TeleprompterSettings = {
  fontSize: 42,
  lineHeight: 1.6,
  viewportHeight: 560,
  anchorRatio: 0.32,
  transitionMs: 360,
  textWidth: 84,
  letterSpacing: 1.2,
  dimReadText: true,
  previewSpeed: 10
};

function loadSettings(): TeleprompterSettings {
  const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!raw) {
    return defaultSettings;
  }

  try {
    return { ...defaultSettings, ...JSON.parse(raw) } as TeleprompterSettings;
  } catch {
    return defaultSettings;
  }
}

function loadScript() {
  return window.localStorage.getItem(SCRIPT_STORAGE_KEY) ?? sampleScript;
}

function loadWsUrl() {
  return (
    window.localStorage.getItem(WS_URL_STORAGE_KEY) ??
    "ws://127.0.0.1:8000/ws/teleprompter"
  );
}

export default function App() {
  const [script, setScript] = useState(loadScript);
  const [settings, setSettings] = useState(loadSettings);
  const [cursor, setCursor] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wsUrl, setWsUrl] = useState(loadWsUrl);
  const ws = useTeleprompterWS();
  const audioCapture = useAudioCapture();

  useEffect(() => {
    window.localStorage.setItem(SCRIPT_STORAGE_KEY, script);
    if (cursor > script.length) {
      setCursor(script.length);
    }
  }, [cursor, script]);

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    window.localStorage.setItem(WS_URL_STORAGE_KEY, wsUrl);
  }, [wsUrl]);

  useEffect(() => {
    if (ws.connectionState === "idle" && audioCapture.isCapturing) {
      void audioCapture.stop();
    }
  }, [audioCapture, ws.connectionState, audioCapture.isCapturing]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const intervalMs = 100;
    const step = Math.max(1, Math.round((settings.previewSpeed * intervalMs) / 1000));
    const timer = window.setInterval(() => {
      setCursor((current) => {
        if (current >= script.length) {
          setIsPlaying(false);
          return script.length;
        }
        return Math.min(script.length, current + step);
      });
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [isPlaying, script.length, settings.previewSpeed]);

  const summary = useMemo(() => {
    const completion = script.length ? Math.round((cursor / script.length) * 100) : 0;
    return `${completion}% · ${settings.fontSize}px · ${settings.viewportHeight}px`;
  }, [cursor, script.length, settings.fontSize, settings.viewportHeight]);

  function updateSetting<K extends keyof TeleprompterSettings>(
    key: K,
    value: TeleprompterSettings[K]
  ) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function resetSample() {
    setScript(sampleScript);
    setCursor(0);
    setIsPlaying(false);
  }

  async function handleConnect() {
    await ws.connect(wsUrl, script);
  }

  async function handleStartMic() {
    if (ws.connectionState !== "connected") {
      await ws.connect(wsUrl, script);
    } else {
      ws.sendControl({ type: "start", script });
    }

    await audioCapture.start((frame) => {
      ws.sendAudioFrame(frame);
    });
  }

  async function handleStopMic() {
    await audioCapture.stop();
    ws.sendControl({ type: "stop" });
  }

  return (
    <div className="app-shell">
      <aside className="workspace">
        <div className="workspace__top">
          <p className="eyebrow">Workspace</p>
          <span className="workspace__summary">{summary}</span>
        </div>

        <ScriptEditor
          script={script}
          onChange={setScript}
          onResetSample={resetSample}
        />
        <ConnectionPanel
          wsUrl={wsUrl}
          wsConnectionState={ws.connectionState}
          backendState={ws.backendState}
          isCapturing={audioCapture.isCapturing}
          transcript={ws.transcript}
          latencyMs={ws.lastLatencyMs}
          error={audioCapture.error ?? ws.lastError}
          onWsUrlChange={setWsUrl}
          onConnect={() => {
            void handleConnect();
          }}
          onDisconnect={() => {
            void audioCapture.stop();
            ws.disconnect();
          }}
          onSyncScript={() => ws.sendControl({ type: "start", script })}
          onStartMic={() => {
            void handleStartMic();
          }}
          onStopMic={() => {
            void handleStopMic();
          }}
          onClearTranscript={ws.clearTranscript}
        />
        <ControlPanel
          cursor={cursor}
          maxCursor={script.length}
          isPlaying={isPlaying}
          settings={settings}
          onCursorChange={(value) => {
            setCursor(value);
            setIsPlaying(false);
          }}
          onSettingsChange={updateSetting}
          onPlayToggle={() => setIsPlaying((value) => !value)}
          onResetCursor={() => {
            setCursor(0);
            setIsPlaying(false);
          }}
          onJumpToEnd={() => {
            setCursor(script.length);
            setIsPlaying(false);
          }}
        />
      </aside>

      <main className="preview">
        <Teleprompter script={script} cursor={cursor} settings={settings} />
      </main>
    </div>
  );
}
