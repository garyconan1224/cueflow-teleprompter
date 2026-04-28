import type { TeleprompterSettings } from "../types/messages";

type ControlPanelProps = {
  cursor: number;
  maxCursor: number;
  isPlaying: boolean;
  settings: TeleprompterSettings;
  onCursorChange: (value: number) => void;
  onSettingsChange: <K extends keyof TeleprompterSettings>(
    key: K,
    value: TeleprompterSettings[K]
  ) => void;
  onPlayToggle: () => void;
  onResetCursor: () => void;
  onJumpToEnd: () => void;
};

type SliderRowProps = {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  suffix?: string;
  onChange: (value: number) => void;
};

function SliderRow({
  label,
  min,
  max,
  step,
  value,
  suffix,
  onChange
}: SliderRowProps) {
  return (
    <label className="field">
      <div className="field__split">
        <span className="field__label">{label}</span>
        <span className="field__value">
          {value}
          {suffix}
        </span>
      </div>
      <input
        className="slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function ControlPanel({
  cursor,
  maxCursor,
  isPlaying,
  settings,
  onCursorChange,
  onSettingsChange,
  onPlayToggle,
  onResetCursor,
  onJumpToEnd
}: ControlPanelProps) {
  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Controls</p>
          <h2>快速调参</h2>
        </div>
      </div>

      <div className="button-row">
        <button className="primary-button" onClick={onPlayToggle} type="button">
          {isPlaying ? "暂停预览" : "自动预览"}
        </button>
        <button className="ghost-button" onClick={onResetCursor} type="button">
          回到开头
        </button>
        <button className="ghost-button" onClick={onJumpToEnd} type="button">
          跳到结尾
        </button>
      </div>

      <SliderRow
        label="当前位置"
        min={0}
        max={Math.max(maxCursor, 1)}
        step={1}
        value={Math.min(cursor, Math.max(maxCursor, 1))}
        onChange={onCursorChange}
      />
      <SliderRow
        label="字号"
        min={24}
        max={80}
        step={1}
        value={settings.fontSize}
        suffix="px"
        onChange={(value) => onSettingsChange("fontSize", value)}
      />
      <SliderRow
        label="行高"
        min={1.1}
        max={2.2}
        step={0.05}
        value={settings.lineHeight}
        onChange={(value) => onSettingsChange("lineHeight", value)}
      />
      <SliderRow
        label="视窗高度"
        min={320}
        max={860}
        step={10}
        value={settings.viewportHeight}
        suffix="px"
        onChange={(value) => onSettingsChange("viewportHeight", value)}
      />
      <SliderRow
        label="锚点比例"
        min={0.18}
        max={0.48}
        step={0.01}
        value={settings.anchorRatio}
        onChange={(value) => onSettingsChange("anchorRatio", value)}
      />
      <SliderRow
        label="滚动时长"
        min={120}
        max={900}
        step={10}
        value={settings.transitionMs}
        suffix="ms"
        onChange={(value) => onSettingsChange("transitionMs", value)}
      />
      <SliderRow
        label="文本宽度"
        min={48}
        max={100}
        step={1}
        value={settings.textWidth}
        suffix="%"
        onChange={(value) => onSettingsChange("textWidth", value)}
      />
      <SliderRow
        label="字间距"
        min={0}
        max={10}
        step={0.2}
        value={settings.letterSpacing}
        suffix="px"
        onChange={(value) => onSettingsChange("letterSpacing", value)}
      />
      <SliderRow
        label="预览速度"
        min={2}
        max={30}
        step={1}
        value={settings.previewSpeed}
        suffix="字/秒"
        onChange={(value) => onSettingsChange("previewSpeed", value)}
      />

      <label className="toggle-row">
        <input
          checked={settings.dimReadText}
          type="checkbox"
          onChange={(event) => onSettingsChange("dimReadText", event.target.checked)}
        />
        <span>已读文本置灰</span>
      </label>
    </section>
  );
}
