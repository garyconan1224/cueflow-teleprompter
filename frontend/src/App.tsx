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
import type {
  AppMode,
  ScreenMode,
  TeleprompterSettings
} from "./types/messages";
import { sampleScript } from "./utils/sampleScript";

const SETTINGS_STORAGE_KEY = "voice-teleprompter:settings";
const SCRIPT_STORAGE_KEY = "voice-teleprompter:script";
const WS_URL_STORAGE_KEY = "voice-teleprompter:ws-url";
const DISPLAY_CHANNEL_NAME = "voice-teleprompter-display-sync";
const SENTENCE_BOUNDARY = /[。！？；!?;,，\n]/;

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
  return Math.min(220, Math.max(60, Math.round(rawValue)));
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

function clampCursor(value: number, scriptLength: number) {
  return Math.max(0, Math.min(value, scriptLength));
}

function getCursorStep(delta: number) {
  const distance = Math.abs(delta);
  if (distance >= 40) {
    return 8;
  }
  if (distance >= 22) {
    return 5;
  }
  if (distance >= 10) {
    return 3;
  }
  return 1;
}

function getTransitionDuration(target: number, visible: number) {
  const distance = Math.abs(target - visible);
  if (distance >= 40) {
    return 220;
  }
  if (distance >= 18) {
    return 180;
  }
  if (distance >= 8) {
    return 140;
  }
  return 110;
}

function isBoundaryCharacter(char: string | undefined) {
  return !!char && SENTENCE_BOUNDARY.test(char);
}

export default function App() {
  const displayOnly = isDisplayOnlyWindow();
  const [script, setScript] = useState(loadScript);
  const [cursor, setCursor] = useState(0);
  const [displayCursor, setDisplayCursor] = useState(0);
  const [settings, setSettings] = useState(loadSettings);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wsUrl, setWsUrl] = useState(loadWsUrl);
  const [isDisplayWindowOpen, setIsDisplayWindowOpen] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [dynamicTransitionMs, setDynamicTransitionMs] = useState(
    defaultSettings.transitionMs
  );
  const channelRef = useRef<BroadcastChannel | null>(null);
  const displayWindowRef = useRef<Window | null>(null);
  const lastHeldBoundaryRef = useRef(-1);
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
            setDisplayCursor(data.payload.cursor);
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
    if (displayCursor > script.length) {
      setDisplayCursor(script.length);
    }
  }, [cursor, displayCursor, displayOnly, script]);

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
    if (displayOnly) {
      setDisplayCursor(cursor);
      return;
    }

    if (displayCursor === cursor) {
      return;
    }

    const delta = cursor - displayCursor;
    const direction = Math.sign(delta);
    const step = getCursorStep(delta) * direction;
    const nextCursor = clampCursor(displayCursor + step, script.length);
    const previousChar = script[Math.max(0, nextCursor - 1)];
    const inVoiceFollow =
      ws.backendState === "listening" && audioCapture.isCapturing && !isPlaying;
    const shouldHoldAtBoundary =
      inVoiceFollow &&
      direction > 0 &&
      isBoundaryCharacter(previousChar) &&
      lastHeldBoundaryRef.current !== nextCursor;

    const nextDelay = shouldHoldAtBoundary ? 170 : 40;
    const nextTransitionMs = inVoiceFollow
      ? getTransitionDuration(cursor, displayCursor)
      : Math.min(settings.transitionMs, 180);

    const timer = window.setTimeout(() => {
      if (shouldHoldAtBoundary) {
        lastHeldBoundaryRef.current = nextCursor;
      }
      setDynamicTransitionMs(nextTransitionMs);
      setDisplayCursor(nextCursor);
    }, nextDelay);

    return () => window.clearTimeout(timer);
  }, [
    audioCapture.isCapturing,
    cursor,
    displayCursor,
    displayOnly,
    isPlaying,
    script,
    settings.transitionMs,
    ws.backendState
  ]);

  useEffect(() => {
    if (displayCursor >= cursor) {
      lastHeldBoundaryRef.current = -1;
    }
  }, [cursor, displayCursor]);

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
    const completion = script.length
      ? Math.round((displayCursor / script.length) * 100)
      : 0;
    return `进度 ${completion}% · 字号 ${settings.fontSize}px · 视窗 ${settings.viewportHeight}%`;
  }, [displayCursor, script.length, settings.fontSize, settings.viewportHeight]);

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

  const teleprompterSettings = useMemo(
    () => ({
      ...settings,
      transitionMs: dynamicTransitionMs
    }),
    [dynamicTransitionMs, settings]
  );

  const appMode = useMemo<AppMode>(() => {
    const combinedError = audioCapture.error ?? ws.lastError ?? manualError;
    if (combinedError) {
      return "error";
    }
    if (ws.connectionState === "connecting") {
      return "connecting";
    }
    if (audioCapture.isCapturing && ws.backendState === "listening") {
      return "listening";
    }
    if (ws.connectionState === "connected" && ws.backendState === "stopped") {
      return "paused";
    }
    if (ws.connectionState === "connected") {
      return "ready";
    }
    return "idle";
  }, [
    audioCapture.error,
    audioCapture.isCapturing,
    manualError,
    ws.backendState,
    ws.connectionState,
    ws.lastError
  ]);

  function updateSetting<K extends keyof TeleprompterSettings>(
    key: K,
    value: TeleprompterSettings[K]
  ) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function replaceScript(nextScript: string) {
    setScript(nextScript);
    setCursor(0);
    setDisplayCursor(0);
    setIsPlaying(false);
    setManualError(null);
    setDynamicTransitionMs(defaultSettings.transitionMs);
    lastHeldBoundaryRef.current = -1;

    if (ws.connectionState === "connected") {
      ws.sendControl({ type: "start", script: nextScript });
    }
  }

  function resetSample() {
    replaceScript(sampleScript);
  }

  async function importScriptFile(file: File) {
    try {
      const text = await file.text();
      replaceScript(text);
    } catch {
      setManualError("导入脚本失败，请检查文件内容后重试。");
    }
  }

  async function pasteClipboardText() {
    if (!navigator.clipboard?.readText) {
      setManualError("当前浏览器不支持读取剪贴板，请直接在文本框里粘贴。");
      return;
    }

    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setManualError("剪贴板里没有可用文本。");
        return;
      }
      replaceScript(text);
    } catch {
      setManualError("读取剪贴板失败，请允许浏览器访问剪贴板。");
    }
  }

  async function handleConnect() {
    setManualError(null);
    await ws.connect(wsUrl, script);
  }

  async function handleStartMic() {
    setIsPlaying(false);
    setManualError(null);
    lastHeldBoundaryRef.current = -1;

    try {
      if (ws.connectionState !== "connected") {
        await ws.connect(wsUrl, script);
      } else {
        ws.sendControl({ type: "start", script });
      }

      await audioCapture.start((frame) => {
        ws.sendAudioFrame(frame);
      });
    } catch {
      setManualError("启动麦克风失败，请检查麦克风权限和后端服务。");
    }
  }

  async function handleStopMic() {
    try {
      await audioCapture.stop();
      ws.sendControl({ type: "stop" });
    } catch {
      setManualError("停止麦克风时发生错误。");
    }
  }

  function syncScriptToBackend() {
    setManualError(null);
    ws.sendControl({ type: "start", script });
  }

  function moveCursor(nextCursor: number) {
    const safeValue = clampCursor(nextCursor, script.length);
    setCursor(safeValue);
    setIsPlaying(false);
    lastHeldBoundaryRef.current = -1;
    if (ws.connectionState === "connected") {
      ws.sendControl({ type: "seek", cursor: safeValue });
    }
  }

  function handleCursorChange(nextCursor: number) {
    moveCursor(nextCursor);
  }

  function handleCursorNudge(delta: number) {
    moveCursor(cursor + delta);
  }

  function handleResetCursor() {
    setCursor(0);
    setDisplayCursor(0);
    setIsPlaying(false);
    setManualError(null);
    setDynamicTransitionMs(defaultSettings.transitionMs);
    lastHeldBoundaryRef.current = -1;
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
      setManualError("副屏窗口被浏览器拦截了，请允许弹窗后重试。");
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
          cursor={displayCursor}
          settings={teleprompterSettings}
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
          onImportFile={importScriptFile}
          onPasteClipboard={() => {
            void pasteClipboardText();
          }}
        />
        <ConnectionPanel
          wsUrl={wsUrl}
          wsConnectionState={ws.connectionState}
          backendState={ws.backendState}
          appMode={appMode}
          isCapturing={audioCapture.isCapturing}
          transcript={ws.transcript}
          latencyMs={ws.lastLatencyMs}
          cursorPosition={cursor}
          matchScore={ws.matchScore}
          matchedText={ws.matchedText}
          isCursorLost={ws.isCursorLost}
          error={audioCapture.error ?? ws.lastError ?? manualError}
          onWsUrlChange={setWsUrl}
          onConnect={() => {
            void handleConnect();
          }}
          onDisconnect={() => {
            setManualError(null);
            void audioCapture.stop();
            ws.disconnect();
          }}
          onSyncScript={syncScriptToBackend}
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
            moveCursor(script.length);
          }}
          onOpenDisplayWindow={openDisplayWindow}
        />
      </aside>

      <main className="preview">
        <Teleprompter
          script={script}
          cursor={displayCursor}
          settings={teleprompterSettings}
          onCursorNudge={handleCursorNudge}
        />
      </main>
    </div>
  );
}
