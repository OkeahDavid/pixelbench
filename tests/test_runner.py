from pixelbench.runner import Measurement, run


def test_cpu_only_run(tiny_size):
    result = run(
        sizes=[tiny_size],
        tasks=["grayscale", "threshold"],
        iterations=2,
        warmup=1,
        use_gpu=False,
    )
    assert len(result.measurements) == 2
    for m in result.measurements:
        assert m.size == tiny_size
        assert m.cpu_ms is not None and m.cpu_ms > 0
        assert m.gpu_ms is None
        assert m.speedup is None


def test_run_records_system_info(tiny_size):
    result = run([tiny_size], ["grayscale"], iterations=1, warmup=0, use_gpu=False)
    for key in ("cpu", "cores", "gpu", "opencl", "cuda", "os", "python", "opencv"):
        assert key in result.system


def test_progress_callback_fires(tiny_size):
    seen = []
    run(
        [tiny_size],
        ["grayscale", "threshold"],
        iterations=1,
        warmup=0,
        use_gpu=False,
        progress=seen.append,
    )
    assert len(seen) == 2
    assert tiny_size in seen[0]


def test_speedup_properties():
    m = Measurement("t", "T", "720p", cpu_ms=10.0, gpu_ms=2.0, cuda_ms=5.0)
    assert m.speedup == 5.0
    assert m.cuda_speedup == 2.0
    empty = Measurement("t", "T", "720p", cpu_ms=10.0)
    assert empty.speedup is None
    assert empty.cuda_speedup is None
