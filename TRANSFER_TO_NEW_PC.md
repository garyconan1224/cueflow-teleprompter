# CueFlow Teleprompter 新电脑执行顺序

这份文档是给“把当前项目搬到另一台 Windows 电脑后怎么跑起来”准备的。

## 先看结论

最简单的顺序只有 4 步：

1. 把打包目录或压缩包解压到新电脑。
2. 双击 `setup_portable_env.bat`。
3. 等依赖安装完成后，双击 `run_portable_app.bat`。
4. 浏览器打开 `http://127.0.0.1:8000`。

## 你会拿到什么

建议使用项目根目录里的打包脚本：

```powershell
& .\package_portable.ps1
```

执行后会生成两样东西：

- `release/cueflow-teleprompter-portable/`
- `release/cueflow-teleprompter-portable.zip`

推荐直接把 `zip` 复制到新电脑，再解压。

## 新电脑需要满足什么

### 必须有

1. Windows
2. Python 3.10 或 3.11
3. 能联网安装 Python 依赖

### 可选但强烈建议有

1. NVIDIA 显卡
2. 可用的 CUDA 环境

如果没有 GPU，程序通常也能跑，但识别速度会慢很多。

## 新电脑上的标准执行顺序

### 第 1 步：解压或复制目录

把下面任一内容放到新电脑的某个目录中：

- `cueflow-teleprompter-portable.zip` 解压后的目录
- 或 `cueflow-teleprompter-portable` 整个文件夹

建议路径尽量简单，例如：

```text
D:\cueflow-teleprompter-portable
```

### 第 2 步：安装运行环境

双击：

- `setup_portable_env.bat`

这个脚本会自动做几件事：

1. 创建 `.venv`
2. 升级 `pip`
3. 安装 `requirements.txt` 里的依赖

首次执行通常会花几分钟。

### 第 3 步：启动程序

双击：

- `run_portable_app.bat`

启动成功后会看到后端服务运行在：

```text
http://127.0.0.1:8000
```

### 第 4 步：打开页面

浏览器打开：

```text
http://127.0.0.1:8000
```

进入页面后就可以：

1. 粘贴或导入提词文案
2. 连接后端
3. 开始麦克风识别

## 第一次启动建议检查什么

### 先看服务是否正常

浏览器打开：

```text
http://127.0.0.1:8000/health
```

如果返回 `{"status":"ok"}`，说明后端已正常运行。

### 再测麦克风

如果你怀疑新电脑麦克风权限或设备有问题，可以先运行：

```powershell
python phase1_asr_test.py --list-devices
python phase1_asr_test.py
```

如果便携目录里已经创建好虚拟环境，也可以直接用：

```powershell
.venv\Scripts\python.exe phase1_asr_test.py
```

## 常见情况

### 双击 `setup_portable_env.bat` 后提示找不到 `python`

说明新电脑没有装 Python，或者 Python 没有加入环境变量。

处理办法：

1. 安装 Python 3.10 或 3.11
2. 安装时勾选 `Add Python to PATH`
3. 重新运行 `setup_portable_env.bat`

### 能启动，但识别很慢

通常是以下原因之一：

1. 新电脑没有 GPU，正在用 CPU 跑识别
2. CUDA 不可用
3. 电源模式较低

可以先看启动日志里是否使用了 `cuda:0`。

### 页面能打开，但开始识别没反应

优先检查：

1. 浏览器是否允许麦克风权限
2. 系统默认输入设备是否正确
3. 是否有别的软件占用了麦克风

### 模型缓存没有带过去

正常打包会尽量复制 `.modelscope_cache`。如果因为某些原因没有带过去，可以在新电脑上运行：

```powershell
.venv\Scripts\python.exe backend\scripts\download_models.py
```

## 推荐的实际使用顺序

每次换电脑后，建议按这个顺序来：

1. 解压便携包
2. 跑 `setup_portable_env.bat`
3. 跑 `run_portable_app.bat`
4. 打开 `/health`
5. 打开主页面
6. 先说一两句短句，确认游标和高亮能推进

## 当前便携包的边界

这份便携包已经把前端构建产物、后端代码、模型缓存和启动脚本整理好了，但它还不是“完全免安装”的单文件 EXE。

当前仍然需要：

1. 新电脑有 Python
2. 首次执行时安装 Python 依赖

如果后面我们要继续收口，还可以再做一版真正的一键绿色版封装。
