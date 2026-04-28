# CueFlow Teleprompter Standalone Package

This branch builds a full Windows standalone package.

The generated package includes:

- embedded Python
- Python dependencies
- built frontend files
- backend service
- model cache, if `.modelscope_cache` exists locally
- one daily startup script: `start_cueflow.bat`

The target computer does not need Python or Node.js installed.

## Build

Run this from the project root:

```powershell
& .\package_standalone.ps1
```

This builds the CPU package.

For an NVIDIA laptop or desktop, build the CUDA package:

```powershell
& .\package_standalone.ps1 -TorchMode cuda -CudaVersion cu121
```

By default, PyTorch CPU/CUDA wheels are downloaded from the Shanghai Jiao Tong University PyTorch wheel mirror. If that mirror is unavailable, switch mirrors:

```powershell
& .\package_standalone.ps1 -TorchMode cuda -CudaVersion cu121 -TorchMirror aliyun
& .\package_standalone.ps1 -TorchMode cuda -CudaVersion cu121 -TorchMirror official
```

The first build can take a long time because it downloads embedded Python and installs the Python dependency stack into `release/_runtime_cache`.

To rebuild the embedded runtime from scratch:

```powershell
& .\package_standalone.ps1 -RefreshRuntime
```

## Output

CPU build:

- `release/cueflow-teleprompter-standalone-cpu/`
- `release/cueflow-teleprompter-standalone-cpu.zip`

CUDA build:

- `release/cueflow-teleprompter-standalone-gpu-cu121/`
- `release/cueflow-teleprompter-standalone-gpu-cu121.zip`

On a clean Windows computer:

1. Extract the zip.
2. Double-click `start_cueflow.bat`.
3. Select `Auto`, `GPU`, or `CPU` in the startup menu.
4. Open `http://127.0.0.1:8000` if the browser does not open automatically.

## Notes

The CPU package is the safest fallback, but ASR can be slow on laptops.

The CUDA package is larger, but it is the recommended package for NVIDIA machines. If GPU mode is selected on a machine without CUDA support, the backend falls back to CPU.

Pip installs use the Tsinghua PyPI mirror by default. Frontend package installs use the `npmmirror` registry during packaging. PyTorch CPU/CUDA wheels use the selected PyTorch wheel mirror, with `sjtu` as the default.
