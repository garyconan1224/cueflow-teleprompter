# CueFlow Teleprompter

`CueFlow Teleprompter` 是一个本地运行的中文语音提词器。

浏览器负责编辑脚本、采集麦克风和显示提词器；后端负责流式语音识别、游标追踪，并通过 WebSocket 把当前位置实时推回前端，让提词内容跟着朗读自动上滑。

## 仓库信息

- 仓库地址：`https://github.com/garyconan1224/cueflow-teleprompter`
- 开源协议：`MIT`
- GitHub 页面配置建议见 [GITHUB_REPO_SETUP.md](GITHUB_REPO_SETUP.md)

## 路径兼容

项目里只保留两个 `.bat` 入口。

- 整个项目目录可以直接挪到别的盘符或文件夹
- 便携包解压到新位置后也可以直接运行
- 脚本会优先使用项目内的 `.venv`，找不到时才回退到系统 `py` 或 `python`
- 如果 `.venv` 是从其他电脑或旧路径搬来的，`setup_portable_env.bat` 会检测并重建它
- `setup_portable_env.bat` 只在当前文件夹里创建 `.venv`，不会安装到系统 Python 环境

## 当前已完成

- `Phase 1` 本地麦克风 ASR 单点验证
- `Phase 2` FastAPI WebSocket 识别服务
- `Phase 3` 浏览器采音到后端识别的完整链路
- `Phase 4` 语音驱动的游标追踪、自动上滑、单双屏、全屏
- 使用增强：直接粘贴文本、导入脚本文件、鼠标滚轮微调位置、当前位置轻量高亮、状态提示、错误提示
- 工程增强：模型预下载脚本、后端测试、前端联调级自动化测试、便携打包脚本

## 怎么添加提词文案

有三种方式：

1. 打开页面后，直接在左侧“脚本编辑”里输入或粘贴文本。
2. 点击“粘贴文本”，直接读取系统剪贴板。
3. 点击“导入文件”，选择 `.txt`、`.md` 或 `.srt` 文件。

如果后端已经连接，新脚本会自动同步给识别链路。

## 运行方式

### 日常使用

1. 首次使用或换电脑后，双击：

- `setup_portable_env.bat`

2. 平时启动程序，双击：

- `run_portable_app.bat`

3. 打开浏览器：

- `http://127.0.0.1:8000`

### 开发联调

1. 启动后端

```powershell
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

2. 启动前端开发服务器

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

3. 打开浏览器

- `http://localhost:5173`

### 集成运行

这个模式下不需要单独启动前端开发服务器，后端会直接托管 `frontend/dist` 里的构建产物。

1. 先构建前端

```powershell
cd frontend
npm.cmd install
npm.cmd run build
```

2. 回到项目根目录启动

```powershell
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

或者直接双击：

- `run_portable_app.bat`

3. 打开浏览器

- `http://127.0.0.1:8000`

## 页面操作说明

1. 在左侧粘贴或导入脚本。
2. 点击“连接后端”。
3. 点击“开始麦克风识别”。
4. 提词内容会根据语音识别结果自动向上滑动，并尽量把当前朗读位置停在虚线附近。
5. 你可以直接用鼠标滚轮微调当前位置，按住 `Shift` 时会更快跳动。
6. 如果位置丢失，可以拖动“当前位置”滑块，或者在提词器里滚轮回调重新对齐。

## 常用测试

### 麦克风单点测试

```powershell
python phase1_asr_test.py
python phase1_asr_test.py --list-devices
```

### WebSocket 示例音频测试

```powershell
python backend/scripts/test_client.py --realtime
```

### 预下载模型

```powershell
python backend/scripts/download_models.py
```

### 后端测试

```powershell
python -m unittest tests.test_matcher tests.test_websocket
python -m compileall backend tests
```

### 前端构建和联调测试

```powershell
cd frontend
npm.cmd install
npx playwright install chromium
npm.cmd run build
npm.cmd run test:e2e
```

## 便携打包

如果你想把项目复制到别的目录，或者复制到另一台 Windows 机器继续使用，可以执行：

```powershell
& .\package_portable.ps1
```

脚本会生成：

- `release/cueflow-teleprompter-portable/`
- `release/cueflow-teleprompter-portable.zip`

便携包里包含：

- 后端代码
- 构建好的前端页面
- 模型缓存（如果当前目录里已有 `.modelscope_cache`）
- `run_portable_app.bat`
- `setup_portable_env.bat`
- `LICENSE`
- 新电脑迁移说明文档

## 目录说明

- [backend/app/main.py](backend/app/main.py): FastAPI 入口，也负责托管构建后的前端页面
- [backend/app/api/websocket.py](backend/app/api/websocket.py): WebSocket 消息协议和识别链路
- [backend/app/asr/engine.py](backend/app/asr/engine.py): FunASR 封装
- [backend/app/tracking/matcher.py](backend/app/tracking/matcher.py): 游标模糊匹配和推进逻辑
- [backend/app/tracking/session.py](backend/app/tracking/session.py): 跟读会话状态
- [frontend/src/App.tsx](frontend/src/App.tsx): 页面主状态、单双屏同步、联动控制
- [frontend/src/components/ScriptEditor.tsx](frontend/src/components/ScriptEditor.tsx): 脚本编辑、粘贴、导入
- [frontend/src/components/Teleprompter.tsx](frontend/src/components/Teleprompter.tsx): 提词显示、自动滑动、滚轮微调、全屏
- [frontend/tests/teleprompter.spec.ts](frontend/tests/teleprompter.spec.ts): 前端联调级自动化测试
