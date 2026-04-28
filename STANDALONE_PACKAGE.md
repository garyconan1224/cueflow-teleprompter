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

The first build can take a long time because it downloads embedded Python and installs the Python dependency stack into `release/_runtime_cache`.

To rebuild the embedded runtime from scratch:

```powershell
& .\package_standalone.ps1 -RefreshRuntime
```

## Output

The script creates:

- `release/cueflow-teleprompter-standalone/`
- `release/cueflow-teleprompter-standalone.zip`

On a clean Windows computer:

1. Extract `cueflow-teleprompter-standalone.zip`.
2. Double-click `start_cueflow.bat`.
3. Open `http://127.0.0.1:8000` if the browser does not open automatically.

## Notes

This package uses CPU PyTorch wheels by default so it can run without requiring the target computer to have CUDA installed. If the target machine has a CUDA setup and you want GPU acceleration, build a separate runtime with matching CUDA PyTorch wheels.
