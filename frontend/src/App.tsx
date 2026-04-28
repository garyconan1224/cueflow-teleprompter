import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from "react";
import { ConnectionPanel } from "./components/ConnectionPanel";
import { ControlPanel } from "./components/ControlPanel";
import { ScriptEditor } from "./components/ScriptEditor";
import { Teleprompter } from "./components/Teleprompter";
import { useAudioCapture } from "./hooks/useAudioCapture";
import { useTeleprompterWS } from "./hooks/useTeleprompterWS";
import type { ScreenMode, TeleprompterSettings } from "./types/messages";
import { sampleScript } from "./utils/sampleScript";

const SETTINGS_STORAGE_KEY = "voice-teleprompter:settings";
const SCRIPT_STORAGE_KEY = "voice-teleprompter:script";
const WS_URL_STORAGE_KEY = "voice-teleprompter:ws-url";
const DISPLAY_CHANNEL_NAME = "voice-teleprompter-display-sync";

type DisplaySyncPayload = {
  script: string;
  cursor: number;
  settings: TeleprompterSettings;
};

type DisplaySyncMessage =
  | { type: "state-sync"; payload: DisplaySyncPayload }
  | { type: "request-sync" };

const defaultSettings: TeleprompterSettings = {
  fontSize: 42,
  lineHeight: 1.6,
  viewportHeight: 72,
  anchorRatio: 0.32,
  transitionMs: 160,
  textWidth: 84,
  letterSpacing: 1.2,
  dimReadText: true,
  previewSpeed: 10,
  screenMode: "single",
  fontPreset: "serif",
  appBackgroundStart: "#f3d39b",
  appBackgroundEnd: "#ead8b2",
  workspaceBackground: "#fff7e9",
  panelBackground: "#fffaf1",
  teleprompterBackgroundTop: "#1e140d",
  teleprompterBackgroundBottom: "#100b07",
  readTextColor: "#baa48a",
  currentTextColor: "#fff9f0",
  upcomingTextColor: "#f3dfc2",
  guideColor: "#f7b86f",
  currentAccentColor: "#ffbe72"
};

function migrateViewportHeight(rawValue: unknown) {
  if (typeof rawValue !== "number" || Number.isNaN(rawValue)) {
    return defaultSettings.viewportHeight;
  }

  if (rawValue <= 100) {
    return Math.min(100, Math.max(45, Math.round(rawValue)));
  }

  const estimatedPercent = Math.round(rawValue / 9);
  return Math.min(100, Math.max(45, estimatedPercent));
}

function migrateTransitionMs(rawValue: unknown) {
  if (typeof rawValue !== "number" || Number.isNaN(rawValue)) {
    return defaultSettings.transitionMs;
  }
  return Math.min(180, Math.max(60, Math.round(rawValue)));
}

function loadSettings(): TeleprompterSettings {
  const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!raw) {
    return defaultSettings;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<TeleprompterSettings>;
    return {
      ...defaultSettings,
      ...parsed,
      viewportHeight: migrateViewportHeight(parsed.viewportHeight),
      transitionMs: migrateTransitionMs(parsed.transitionMs)
    };
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

function isDisplayOnlyWindow() {
  return new URLSearchParams(window.location.search).get("display") === "1";
}

export default function App() {
  const displayOnly = isDisplayOnlyWindow();
  const [script, setScript] = useState(loadScript);
  const [settings, setSettings] = useState(loadSettings);
  const [cursor, setCursor] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wsUrl, setWsUrl] = useState(loadWsUrl);
  const [isDisplayWindowOpen, setIsDisplayWindowOpen] = useState(false);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const displayWindowRef = useRef<Window | null>(null);
  const sharedStateRef = useRef<DisplaySyncPayload>({
    script,
    cursor,
    settings
  });
  const ws = useTeleprompterWS();
  const audioCapture = useAudioCapture();

  useEffect(() => {
    sharedStateRef.current = { script, cursor, settings };
  }, [script, cursor, settings]);

  useEffect(() => {
    const channel = new BroadcastChannel(DISPLAY_CHANNEL_NAME);
    channelRef.current = channel;

    channel.onmessage = (event: MessageEvent<DisplaySyncMessage>) => {
      const data = event.data;

      if (displayOnly) {
        if (data.type === "state-sync") {
          startTransition(() => {
            setScript(data.payload.script);
            setCursor(data.payload.cursor);
            setSettings(data.payload.settings);
          });
        }
        return;
      }

      if (data.type === "request-sync") {
        channel.postMessage({
          type: "state-sync",
          payload: sharedStateRef.current
        } satisfies DisplaySyncMessage);
      }
    };

    if (displayOnly) {
      channel.postMessage({ type: "request-sync" } satisfies DisplaySyncMessage);
    }

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [displayOnly]);

  useEffect(() => {
    if (displayOnly) {
      return;
    }

    channelRef.current?.postMessage({
      type: "state-sync",
      payload: { script, cursor, settings }
    } satisfies DisplaySyncMessage);
  }, [cursor, displayOnly, script, settings]);

  useEffect(() => {
    if (displayOnly) {
      return;
    }

    const timer = window.setInterval(() => {
      const isOpen = !!displayWindowRef.current && !displayWindowRef.current.closed;
      setIsDisplayWindowOpen(isOpen);
      if (!isOpen) {
        displayWindowRef.current = null;
      }
    }, 600);

    return () => window.clearInterval(timer);
  }, [displayOnly]);

  useEffect(() => {
    if (displayOnly) {
      return;
    }

    window.localStorage.setItem(SCRIPT_STORAGE_KEY, script);
    if (cursor > script.length) {
      setCursor(script.length);
    }
  }, [cursor, displayOnly, script]);

  useEffect(() => {
    if (displayOnly) {
      return;
    }
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [displayOnly, settings]);

  useEffect(() => {
    if (displayOnly) {
      return;
    }
    window.localStorage.setItem(WS_URL_STORAGE_KEY, wsUrl);
  }, [displayOnly, wsUrl]);

  useEffect(() => {
    if (displayOnly) {
      return;
    }
    if (ws.connectionState === "idle" && audioCapture.isCapturing) {
      void audioCapture.stop();
    }
  }, [audioCapture, displayOnly, ws.connectionState]);

  useEffect(() => {
    if (displayOnly || ws.cursorPosition === null) {
      return;
    }

    startTransition(() => {
      setCursor(Math.min(script.length, ws.cursorPosition ?? 0));
      setIsPlaying(false);
    });
  }, [displayOnly, script.length, ws.cursorPosition]);

  useEffect(() => {
    if (displayOnly || !isPlaying) {
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
  }, [displayOnly, isPlaying, script.length, settings.previewSpeed]);

  const summary = useMemo(() => {
    const completion = script.length ? Math.round((cursor / script.length) * 100) : 0;
    return `进度 ${completion}% · 字号 ${settings.fontSize}px · 视窗 ${settings.viewportHeight}%`;
  }, [cursor, script.length, settings.fontSize, settings.viewportHeight]);

  const appStyle = useMemo(
    () =>
      ({
        "--app-bg-start": settings.appBackgroundStart,
        "--app-bg-end": settings.appBackgroundEnd,
        "--workspace-bg": settings.workspaceBackground,
        "--panel-bg": settings.panelBackground,
        "--teleprompter-bg-top": settings.teleprompterBackgroundTop,
        "--teleprompter-bg-bottom": settings.teleprompterBackgroundBottom,
        "--teleprompter-read-color": settings.readTextColor,
        "--teleprompter-current-color": settings.currentTextColor,
        "--teleprompter-upcoming-color": settings.upcomingTextColor,
        "--teleprompter-guide-color": settings.guideColor,
        "--teleprompter-current-accent": settings.currentAccentColor
      }) as CSSProperties,
    [settings]
  );

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
    setIsPlaying(false);

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

  function handleCursorChange(nextCursor: number) {
    setCursor(nextCursor);
    setIsPlaying(false);
    if (ws.connectionState === "connected") {
      ws.sendControl({ type: "seek", cursor: nextCursor });
    }
  }

  function handleResetCursor() {
    setCursor(0);
    setIsPlaying(false);
    if (ws.connectionState === "connected") {
      ws.sendControl({ type: "reset" });
      ws.sendControl({ type: "start", script });
    }
  }

  function openDisplayWindow() {
    const opened = window.open(
      `${window.location.pathname}?display=1`,
      "TeleprompterDisplay",
      "popup=yes,width=1440,height=900"
    );

    if (!opened) {
      return;
    }

    displayWindowRef.current = opened;
    opened.focus();
    setIsDisplayWindowOpen(true);
    channelRef.current?.postMessage({
      type: "state-sync",
      payload: { script, cursor, settings }
    } satisfies DisplaySyncMessage);
  }

  function handleScreenModeChange(mode: ScreenMode) {
    updateSetting("screenMode", mode);
    if (mode === "dual") {
      openDisplayWindow();
    }
  }

  if (displayOnly) {
    return (
      <div className="display-window" style={appStyle}>
        <Teleprompter
          script={script}
          cursor={cursor}
          settings={settings}
          title="副屏提词器"
          compactHeader
        />
      </div>
    );
  }

  return (
    <div className="app-shell" style={appStyle}>
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
          cursorPosition={ws.cursorPosition}
          matchScore={ws.matchScore}
          matchedText={ws.matchedText}
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
          isDisplayWindowOpen={isDisplayWindowOpen}
          settings={settings}
          onCursorChange={handleCursorChange}
          onSettingsChange={(key, value) => {
            if (key === "screenMode") {
              handleScreenModeChange(value as ScreenMode);
              return;
            }
            updateSetting(key, value);
          }}
          onPlayToggle={() => setIsPlaying((value) => !value)}
          onResetCursor={handleResetCursor}
          onJumpToEnd={() => {
            const end = script.length;
            setCursor(end);
            setIsPlaying(false);
            if (ws.connectionState === "connected") {
              ws.sendControl({ type: "seek", cursor: end });
            }
          }}
          onOpenDisplayWindow={openDisplayWindow}
        />
      </aside>

      <main className="preview">
        <Teleprompter script={script} cursor={cursor} settings={settings} />
      </main>
    </div>
  );
}
