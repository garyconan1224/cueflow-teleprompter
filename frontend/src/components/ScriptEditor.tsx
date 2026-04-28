type ScriptEditorProps = {
  script: string;
  onChange: (value: string) => void;
  onResetSample: () => void;
};

export function ScriptEditor({
  script,
  onChange,
  onResetSample
}: ScriptEditorProps) {
  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Script</p>
          <h2>脚本编辑</h2>
        </div>
        <button className="ghost-button" onClick={onResetSample} type="button">
          载入示例
        </button>
      </div>

      <label className="field">
        <span className="field__label">提词脚本</span>
        <textarea
          className="script-input"
          value={script}
          onChange={(event) => onChange(event.target.value)}
          placeholder="把演讲稿粘贴到这里，右侧会实时预览。"
        />
      </label>

      <div className="meta-row">
        <span>{script.length} 字符</span>
        <span>{script.trim() ? script.trim().split(/\s+/).length : 0} 段文本块</span>
      </div>
    </section>
  );
}
