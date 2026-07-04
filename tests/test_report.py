import io
import json

from rich.console import Console

from pixelbench.report import leaderboard_row, print_report, save_json, to_dict
from pixelbench.runner import BenchmarkResult, Measurement


def _result(with_cuda: bool = False) -> BenchmarkResult:
    return BenchmarkResult(
        system={
            "cpu": "Test CPU",
            "cores": 8,
            "gpu": "Test GPU",
            "gpu_type": "iGPU",
            "opencl": True,
            "cuda": with_cuda,
            "cuda_device": "Test CUDA GPU" if with_cuda else None,
            "os": "TestOS 1",
            "python": "3.12.0",
            "opencv": "5.0.0",
        },
        iterations=5,
        warmup=2,
        measurements=[
            Measurement(
                "grayscale", "Grayscale conversion", "720p",
                cpu_ms=2.0, gpu_ms=1.0,
                cuda_ms=0.5 if with_cuda else None,
            ),
            Measurement(
                "median_blur", "Median blur 5x5", "720p",
                cpu_ms=8.0, gpu_ms=None, gpu_error="unsupported op",
                cuda_error="CUDA median filter is single-channel only" if with_cuda else None,
            ),
        ],
    )


def test_to_dict_structure():
    d = to_dict(_result())
    assert d["system"]["cpu"] == "Test CPU"
    assert len(d["measurements"]) == 2
    first = d["measurements"][0]
    assert first["speedup"] == 2.0
    assert first["cuda_ms"] is None


def test_to_dict_includes_cuda():
    d = to_dict(_result(with_cuda=True))
    assert d["measurements"][0]["cuda_speedup"] == 4.0
    assert d["measurements"][1]["cuda_error"]


def test_save_json_roundtrip(tmp_path):
    path = save_json(_result(), tmp_path / "out.json")
    loaded = json.loads(path.read_text())
    assert loaded["iterations"] == 5


def test_leaderboard_row_contains_hardware_and_speedup():
    row = leaderboard_row(_result())
    assert "Test CPU" in row
    assert "Test GPU" in row
    assert "2.00x" in row


def test_print_report_renders_without_error():
    for with_cuda in (False, True):
        console = Console(file=io.StringIO(), width=120)
        print_report(_result(with_cuda), console)
        out = console.file.getvalue()
        assert "Grayscale conversion" in out
        assert ("CUDA" in out) == with_cuda
