#!/usr/bin/env python3
"""
Phase 1: FunASR 流式识别单点验证脚本。

目标：
1. 从默认麦克风连续采集 16kHz 单声道音频
2. 调用 FunASR 流式模型做实时中文识别
3. 打印识别文本与单块推理延迟，便于人工验收

用法示例：
    python phase1_asr_test.py
    python phase1_asr_test.py --device cuda:0
    python phase1_asr_test.py --chunk-size 0,8,4 --max-seconds 60
"""

from __future__ import annotations

import argparse
import os
import statistics
import sys
import time
from pathlib import Path
from dataclasses import dataclass
from typing import Any

import numpy as np

try:
    import sounddevice as sd
except ImportError as exc:  # pragma: no cover - 运行时依赖提醒
    raise SystemExit(
        "缺少依赖 sounddevice，请先执行 `pip install sounddevice`。"
    ) from exc

try:
    import torch
except ImportError as exc:  # pragma: no cover - 运行时依赖提醒
    raise SystemExit(
        "缺少依赖 torch，请先根据 CUDA 版本安装 PyTorch。"
    ) from exc

try:
    from funasr import AutoModel
except ImportError as exc:  # pragma: no cover - 运行时依赖提醒
    raise SystemExit("缺少依赖 funasr，请先执行 `pip install funasr`。") from exc


@dataclass(slots=True)
class StreamConfig:
    model: str
    device: str
    model_revision: str | None
    cache_dir: Path
    input_device: str | int | None
    list_devices: bool
    sample_rate: int
    chunk_size: list[int]
    encoder_chunk_look_back: int
    decoder_chunk_look_back: int
    max_seconds: float | None

    @property
    def chunk_samples(self) -> int:
        """
        FunASR 官方示例使用 `chunk_size[1] * 960` 作为 16k 音频的输入块大小。
        例如 [0, 10, 5] 表示每次送入 600ms，也就是 9600 个采样点。
        """
        return self.chunk_size[1] * 960

    @property
    def chunk_duration_ms(self) -> float:
        return self.chunk_samples / self.sample_rate * 1000


def parse_args() -> StreamConfig:
    parser = argparse.ArgumentParser(
        description="Phase 1: FunASR 流式识别单点验证脚本"
    )
    parser.add_argument(
        "--model",
        default="paraformer-zh-streaming",
        help="FunASR 模型 ID 或本地模型路径，默认 paraformer-zh-streaming",
    )
    parser.add_argument(
        "--device",
        default="auto",
        help="推理设备，如 auto / cpu / cuda / cuda:0",
    )
    parser.add_argument(
        "--model-revision",
        default=None,
        help="可选：固定模型版本，便于复现实验结果",
    )
    parser.add_argument(
        "--cache-dir",
        default=".modelscope_cache",
        help="模型缓存目录，默认放在项目目录下的 .modelscope_cache，避免系统目录权限问题",
    )
    parser.add_argument(
        "--input-device",
        default=None,
        help="可选：指定麦克风设备名称或索引，不传则使用系统默认输入设备",
    )
    parser.add_argument(
        "--list-devices",
        action="store_true",
        help="仅打印本机音频设备列表，不启动识别",
    )
    parser.add_argument(
        "--sample-rate",
        type=int,
        default=16000,
        help="采样率，默认 16000",
    )
    parser.add_argument(
        "--chunk-size",
        default="0,10,5",
        help="FunASR 流式 chunk 配置，默认 0,10,5（约 600ms）",
    )
    parser.add_argument(
        "--encoder-look-back",
        type=int,
        default=4,
        help="encoder_chunk_look_back，默认 4",
    )
    parser.add_argument(
        "--decoder-look-back",
        type=int,
        default=1,
        help="decoder_chunk_look_back，默认 1",
    )
    parser.add_argument(
        "--max-seconds",
        type=float,
        default=None,
        help="可选：运行多少秒后自动停止，默认一直运行到 Ctrl+C",
    )
    args = parser.parse_args()

    try:
        chunk_size = [int(part.strip()) for part in args.chunk_size.split(",")]
    except ValueError as exc:
        raise SystemExit("--chunk-size 必须是逗号分隔的整数，例如 0,10,5") from exc

    if len(chunk_size) != 3:
        raise SystemExit("--chunk-size 必须包含 3 个整数，例如 0,10,5")
    if args.sample_rate != 16000:
        raise SystemExit("当前脚本按 16kHz 流式识别参数编写，请保持 --sample-rate 16000")

    return StreamConfig(
        model=args.model,
        device=resolve_device(args.device),
        model_revision=args.model_revision,
        cache_dir=Path(args.cache_dir).resolve(),
        input_device=parse_input_device(args.input_device),
        list_devices=args.list_devices,
        sample_rate=args.sample_rate,
        chunk_size=chunk_size,
        encoder_chunk_look_back=args.encoder_look_back,
        decoder_chunk_look_back=args.decoder_look_back,
        max_seconds=args.max_seconds,
    )


def resolve_device(requested: str) -> str:
    if requested != "auto":
        return requested
    return "cuda:0" if torch.cuda.is_available() else "cpu"


def parse_input_device(raw_value: str | None) -> str | int | None:
    if raw_value is None:
        return None
    return int(raw_value) if raw_value.isdigit() else raw_value


def print_audio_devices() -> None:
    print("可用音频设备：")
    print(sd.query_devices())


def print_runtime_banner(config: StreamConfig) -> None:
    print("=" * 72)
    print("Phase 1: FunASR 流式识别单点验证")
    print(f"模型: {config.model}")
    print(f"设备: {config.device}")
    print(f"模型缓存: {config.cache_dir}")
    print(f"输入设备: {config.input_device if config.input_device is not None else '系统默认'}")
    print(f"采样率: {config.sample_rate} Hz")
    print(
        "chunk_size: "
        f"{config.chunk_size} -> {config.chunk_samples} samples / {config.chunk_duration_ms:.0f} ms"
    )
    print(
        "look_back: "
        f"encoder={config.encoder_chunk_look_back}, decoder={config.decoder_chunk_look_back}"
    )
    if config.max_seconds is not None:
        print(f"自动停止: {config.max_seconds:.1f} 秒")
    if config.device.startswith("cuda") and torch.cuda.is_available():
        print(f"GPU: {torch.cuda.get_device_name(0)}")
    print("=" * 72)


def build_model(config: StreamConfig) -> Any:
    config.cache_dir.mkdir(parents=True, exist_ok=True)
    # ModelScope / HuggingFace 都可能被底层依赖触发，统一指向项目内目录更稳妥。
    os.environ["MODELSCOPE_CACHE"] = str(config.cache_dir)
    os.environ.setdefault("HF_HOME", str(config.cache_dir / "hf"))

    model_kwargs: dict[str, Any] = {
        "model": config.model,
        "device": config.device,
        "disable_update": True,
    }
    if config.model_revision:
        model_kwargs["model_revision"] = config.model_revision

    print("正在加载 FunASR 模型，这一步首次运行可能会自动下载模型文件...")
    t0 = time.perf_counter()
    model = AutoModel(**model_kwargs)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    print(f"模型加载完成，耗时 {elapsed_ms:.0f} ms")
    return model


def extract_text(result: Any) -> str:
    if not result:
        return ""
    if isinstance(result, dict):
        return str(result.get("text", "")).strip()
    if isinstance(result, list):
        texts: list[str] = []
        for item in result:
            if isinstance(item, dict):
                text = str(item.get("text", "")).strip()
                if text:
                    texts.append(text)
        return " ".join(texts).strip()
    return str(result).strip()


def print_summary(latencies_ms: list[float], chunk_count: int) -> None:
    print("\n识别结束，统计如下：")
    print(f"- 音频块数量: {chunk_count}")
    if not latencies_ms:
        print("- 本次没有采集到可统计的推理数据")
        return

    p95_index = max(0, min(len(latencies_ms) - 1, int(len(latencies_ms) * 0.95) - 1))
    sorted_latencies = sorted(latencies_ms)
    print(f"- 平均推理延迟: {statistics.fmean(latencies_ms):.1f} ms")
    print(f"- P95 推理延迟: {sorted_latencies[p95_index]:.1f} ms")
    print(f"- 最大推理延迟: {max(latencies_ms):.1f} ms")


def main() -> int:
    config = parse_args()
    if config.list_devices:
        print_audio_devices()
        return 0

    print_runtime_banner(config)
    model = build_model(config)

    cache: dict[str, Any] = {}
    latencies_ms: list[float] = []
    chunk_count = 0
    last_text = ""
    session_started_at = time.perf_counter()

    print("开始监听麦克风。说中文即可看到识别结果，按 Ctrl+C 停止。")

    try:
        with sd.InputStream(
            samplerate=config.sample_rate,
            channels=1,
            dtype="float32",
            blocksize=config.chunk_samples,
            device=config.input_device,
        ) as stream:
            while True:
                if (
                    config.max_seconds is not None
                    and time.perf_counter() - session_started_at >= config.max_seconds
                ):
                    print("\n达到设定时长，自动停止。")
                    break

                audio_chunk, overflowed = stream.read(config.chunk_samples)
                chunk_count += 1
                if overflowed:
                    print(f"[chunk {chunk_count:04d}] 警告：音频输入发生 overflow，结果可能抖动")

                # sounddevice 读到的是 (samples, channels)，这里只取单声道并确保为 float32。
                chunk = np.asarray(audio_chunk[:, 0], dtype=np.float32)

                infer_started_at = time.perf_counter()
                result = model.generate(
                    input=chunk,
                    cache=cache,
                    is_final=False,
                    chunk_size=config.chunk_size,
                    encoder_chunk_look_back=config.encoder_chunk_look_back,
                    decoder_chunk_look_back=config.decoder_chunk_look_back,
                )
                latency_ms = (time.perf_counter() - infer_started_at) * 1000
                latencies_ms.append(latency_ms)

                text = extract_text(result)
                if text and text != last_text:
                    print(f"[chunk {chunk_count:04d}] [{latency_ms:6.1f} ms] {text}")
                    last_text = text
    except KeyboardInterrupt:
        print("\n收到 Ctrl+C，正在结束识别。")
    except Exception as exc:
        print(f"\n运行失败：{exc}", file=sys.stderr)
        return 1
    finally:
        print_summary(latencies_ms, chunk_count)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
