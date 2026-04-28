import type {
  FontPreset,
  ScreenMode,
  TeleprompterSettings
} from "../types/messages";

type ControlPanelProps = {
  cursor: number;
  maxCursor: number;
  isPlaying: boolean;
  isDisplayWindowOpen: boolean;
  settings: TeleprompterSettings;
  onCursorChange: (value: number) => void;
  onSettingsChange: <K extends keyof TeleprompterSettings>(
    key: K,
    value: TeleprompterSettings[K]
  ) => void;
  onPlayToggle: () => void;
  onResetCursor: () => void;
  onJumpToEnd: () => void;
  onOpenDisplayWindow: () => void;
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

type ChoiceRowProps<T extends string> = {
  label: string;
  value: T;
  options: Array<{ label: string; value: T }>;
  onChange: (value: T) => void;
};

type ColorRowProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
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

function ChoiceRow<T extends string>({
  label,
  value,
  options,
  onChange
}: ChoiceRowProps<T>) {
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <div className="choice-row">
        {options.map((option) => (
          <button
            key={option.value}
            className={
              option.value === value
                ? "choice-button choice-button--active"
                : "choice-button"
            }
            type="button"
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ColorRow({ label, value, onChange }: ColorRowProps) {
  return (
    <label className="field color-field">
      <div className="field__split">
        <span className="field__label">{label}</span>
        <span className="field__value">{value}</span>
      </div>
      <div className="color-input-wrap">
        <input
          className="color-input"
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </label>
  );
}

export function ControlPanel({
  cursor,
  maxCursor,
  isPlaying,
  isDisplayWindowOpen,
  settings,
  onCursorChange,
  onSettingsChange,
  onPlayToggle,
  onResetCursor,
  onJumpToEnd,
  onOpenDisplayWindow
}: ControlPanelProps) {
  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Controls</p>
          <h2>提词器控制台</h2>
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

      <ChoiceRow<ScreenMode>
        label="屏幕模式"
        value={settings.screenMode}
        options={[
          { label: "单屏", value: "single" },
          { label: "双屏", value: "dual" }
        ]}
        onChange={(value) => onSettingsChange("screenMode", value)}
      />

      <ChoiceRow<FontPreset>
        label="字体风格"
        value={settings.fontPreset}
        options={[
          { label: "衬线", value: "serif" },
          { label: "无衬线", value: "sans" }
        ]}
        onChange={(value) => onSettingsChange("fontPreset", value)}
      />

      {settings.screenMode === "dual" ? (
        <div className="field">
          <span className="field__label">副屏窗口</span>
          <div className="button-row">
            <button className="primary-button" onClick={onOpenDisplayWindow} type="button">
              {isDisplayWindowOpen ? "重新打开副屏窗口" : "打开副屏窗口"}
            </button>
          </div>
        </div>
      ) : null}

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
        max={92}
        step={1}
        value={settings.fontSize}
        suffix="px"
        onChange={(value) => onSettingsChange("fontSize", value)}
      />
      <SliderRow
        label="行高"
        min={1.1}
        max={2.4}
        step={0.05}
        value={settings.lineHeight}
        onChange={(value) => onSettingsChange("lineHeight", value)}
      />
      <SliderRow
        label="视窗高度"
        min={45}
        max={100}
        step={1}
        value={settings.viewportHeight}
        suffix="%"
        onChange={(value) => onSettingsChange("viewportHeight", value)}
      />
      <SliderRow
        label="锚点比例"
        min={0.15}
        max={0.48}
        step={0.01}
        value={settings.anchorRatio}
        onChange={(value) => onSettingsChange("anchorRatio", value)}
      />
      <SliderRow
        label="滚动时长"
        min={60}
        max={320}
        step={10}
        value={settings.transitionMs}
        suffix="ms"
        onChange={(value) => onSettingsChange("transitionMs", value)}
      />
      <SliderRow
        label="文本宽度"
        min={40}
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

      <div className="field">
        <span className="field__label">界面主题</span>
        <div className="color-grid">
          <ColorRow
            label="页面顶部背景"
            value={settings.appBackgroundStart}
            onChange={(value) => onSettingsChange("appBackgroundStart", value)}
          />
          <ColorRow
            label="页面底部背景"
            value={settings.appBackgroundEnd}
            onChange={(value) => onSettingsChange("appBackgroundEnd", value)}
          />
          <ColorRow
            label="侧栏背景"
            value={settings.workspaceBackground}
            onChange={(value) => onSettingsChange("workspaceBackground", value)}
          />
          <ColorRow
            label="卡片背景"
            value={settings.panelBackground}
            onChange={(value) => onSettingsChange("panelBackground", value)}
          />
          <ColorRow
            label="提词器上部背景"
            value={settings.teleprompterBackgroundTop}
            onChange={(value) => onSettingsChange("teleprompterBackgroundTop", value)}
          />
          <ColorRow
            label="提词器下部背景"
            value={settings.teleprompterBackgroundBottom}
            onChange={(value) => onSettingsChange("teleprompterBackgroundBottom", value)}
          />
          <ColorRow
            label="已读文字颜色"
            value={settings.readTextColor}
            onChange={(value) => onSettingsChange("readTextColor", value)}
          />
          <ColorRow
            label="未读文字颜色"
            value={settings.upcomingTextColor}
            onChange={(value) => onSettingsChange("upcomingTextColor", value)}
          />
          <ColorRow
            label="定位线颜色"
            value={settings.guideColor}
            onChange={(value) => onSettingsChange("guideColor", value)}
          />
        </div>
      </div>
    </section>
  );
}
