# Voice Teleprompter

本项目是一个本地运行的中文语音提词器：浏览器采集麦克风音频，后端用 FunASR 做流式识别，再把游标位置通过 WebSocket 推回前端，让提词脚本自动上滑。

## 现在已经完成的范围

- Phase 1：本地麦克风 ASR 单点验证
- Phase 2：FastAPI WebSocket ASR 服务
- Phase 3：浏览器采音到后端识别的完整链路
- Phase 4：语音驱动的游标追踪、平滑滚动、单双屏、全屏、主题调节
- 补充收尾：脚本文件导入、位置丢失提示、模型预下载脚本、WebSocket 端到端测试

## 怎么添加文本文案

有两种方式：

1. 打开前端页面，在左侧“脚本编辑”里直接粘贴演讲稿。
2. 点击“导入文件”，选择 `.txt`、`.md` 或 `.srt` 文件，脚本会自动载入到编辑区。

如果后端已经连接，导入新脚本后会自动把新文本同步给后端。

## 快速启动

### 后端

```powershell
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

或者直接双击：

- `run_backend_server.bat`

### 前端

```powershell
cd frontend
npm.cmd run dev
```

或者直接双击：

- `run_frontend_dev.bat`

页面地址：

- `http://localhost:5173`

## 常用测试

### 1. 麦克风单点测试

```powershell
python phase1_asr_test.py
```

列出设备：

```powershell
python phase1_asr_test.py --list-devices
```

### 2. WebSocket 示例音频测试

```powershell
python backend/scripts/test_client.py --realtime
```

### 3. 模型预下载

```powershell
python backend/scripts/download_models.py
```

### 4. 自动化测试

```powershell
python -m unittest tests.test_matcher tests.test_websocket
```

## 目录说明

- [backend/app/main.py](backend/app/main.py)：FastAPI 入口
- [backend/app/api/websocket.py](backend/app/api/websocket.py)：WebSocket 协议与消息处理
- [backend/app/asr/engine.py](backend/app/asr/engine.py)：FunASR 封装
- [backend/app/tracking/matcher.py](backend/app/tracking/matcher.py)：游标模糊匹配
- [frontend/src/components/Teleprompter.tsx](frontend/src/components/Teleprompter.tsx)：提词器显示与滚动
- [frontend/src/components/ScriptEditor.tsx](frontend/src/components/ScriptEditor.tsx)：脚本编辑与文件导入

## 当前使用说明

1. 在前端导入或粘贴脚本。
2. 点击“连接后端”。
3. 点击“开始麦克风识别”。
4. 朗读时，文本会根据识别游标自动向上滑动。
5. 如果出现“跟读位置暂时丢失”，可以拖动当前位置重新对齐，再继续朗读。
