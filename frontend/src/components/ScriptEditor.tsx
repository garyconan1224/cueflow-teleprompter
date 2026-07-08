import { useRef, useState } from "react";

type ScriptEditorProps = {
  script: string;
  defaultExpanded?: boolean;
  onChange: (value: string) => void;
  onResetSample: () => void;
  onImportFile: (file: File) => void | Promise<void>;
  onPasteClipboard: () => void | Promise<void>;
};

export function ScriptEditor({
  script,
  defaultExpanded = true,
  onChange,
  onResetSample,
  onImportFile,
  onPasteClipboard
}: ScriptEditorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [collapsed, setCollapsed] = useState(!defaultExpanded);

  return (
    <section className={`panel${" panel--collapsible"}`}>
      <div className="panel__header">
        <div
          onClick={() => setCollapsed((v) => !v)}
        >
          <p className="eyebrow">Script</p>
          <h2>
            脚本编辑
            <span
              className={`panel__collapse-icon${collapsed ? " panel__collapse-icon--collapsed" : ""}`}
            >
              ▾
            </span>
          </h2>
        </div>
        <div className="button-row button-row--tight">
          <button className="ghost-button" onClick={onPasteClipboard} type="button">
            粘贴文本
          </button>
          <button
            className="ghost-button"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            导入文件
          </button>
          <button className="ghost-button" onClick={onResetSample} type="button">
            载入示例
          </button>
        </div>
      </div>

      <div
        className={`panel__body${collapsed ? " panel__body--collapsed" : ""}`}
      >
        <input
          ref={fileInputRef}
          accept=".txt,.md,.srt"
          hidden
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) {
              return;
            }
            void onImportFile(file);
            event.currentTarget.value = "";
          }}
        />

        <label className="field">
          <span className="field__label">提词脚本</span>
          <textarea
            data-testid="script-input"
            className="script-input"
            value={script}
            onChange={(event) => onChange(event.target.value)}
            placeholder="把演讲稿直接粘贴到这里，右侧会实时预览。"
          />
        </label>

        <div className="meta-row">
          <span>{script.length} 个字符</span>
          <span>{script.trim() ? script.trim().split(/\s+/).length : 0} 段文本块</span>
        </div>
      </div>
    </section>
  );
}
