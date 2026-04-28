import { useEffect, useMemo, useState } from "react";
import { ControlPanel } from "./components/ControlPanel";
import { ScriptEditor } from "./components/ScriptEditor";
import { Teleprompter } from "./components/Teleprompter";
import type { TeleprompterSettings } from "./types/messages";
import { sampleScript } from "./utils/sampleScript";

const SETTINGS_STORAGE_KEY = "voice-teleprompter:settings";
const SCRIPT_STORAGE_KEY = "voice-teleprompter:script";

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

export default function App() {
  const [script, setScript] = useState(loadScript);
  const [settings, setSettings] = useState(loadSettings);
  const [cursor, setCursor] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

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
