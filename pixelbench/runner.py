"""Benchmark execution: warmup, timed runs, CPU vs GPU comparison.

Methodology:
- The test image is generated once per size and uploaded to the GPU
  before timing starts, so numbers measure compute, not PCIe/RAM transfer.
- Each op gets warmup runs first (OpenCL compiles kernels on first use).
- Each timed iteration is measured individually; the reported time is the
  median, which is robust against OS scheduling spikes.
- cv2.ocl.finish() is called after every GPU op so async work can't leak
  out of the timing window.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field

import cv2
import numpy as np

from .tasks import SIZES, TASKS, Task, make_test_image


@dataclass
class Measurement:
    task: str
    label: str
    size: str
    cpu_ms: float | None = None
    gpu_ms: float | None = None
    gpu_error: str | None = None
    cuda_ms: float | None = None
    cuda_error: str | None = None

    @property
    def speedup(self) -> float | None:
        if self.cpu_ms and self.gpu_ms:
            return self.cpu_ms / self.gpu_ms
        return None

    @property
    def cuda_speedup(self) -> float | None:
        if self.cpu_ms and self.cuda_ms:
            return self.cpu_ms / self.cuda_ms
        return None


@dataclass
class BenchmarkResult:
    system: dict
    iterations: int
    warmup: int
    measurements: list[Measurement] = field(default_factory=list)


def _time_op(fn, arg, iterations: int, warmup: int, sync: bool) -> float:
    """Median wall-clock milliseconds for one op over `iterations` runs."""
    for _ in range(warmup):
        fn(arg)
    if sync:
        cv2.ocl.finish()
    samples = []
    for _ in range(iterations):
        t0 = time.perf_counter()
        fn(arg)
        if sync:
            cv2.ocl.finish()
        samples.append((time.perf_counter() - t0) * 1000.0)
    return float(np.median(samples))


def run(
    sizes: list[str],
    tasks: list[str],
    iterations: int = 20,
    warmup: int = 5,
    use_gpu: bool = True,
    progress=None,
) -> BenchmarkResult:
    """Run the benchmark suite. `progress` is an optional callback(str)."""
    from . import cuda_tasks, sysinfo

    system = sysinfo.collect()
    gpu_ok = use_gpu and system["opencl"]
    if gpu_ok:
        cv2.ocl.setUseOpenCL(True)
    cuda_ok = use_gpu and system["cuda"]

    result = BenchmarkResult(system=system, iterations=iterations, warmup=warmup)

    for size_name in sizes:
        w, h = SIZES[size_name]
        color = make_test_image(w, h)
        gray = cv2.cvtColor(color, cv2.COLOR_BGR2GRAY)
        inputs_cpu = {"color": color, "gray": gray}
        inputs_gpu = (
            {"color": cv2.UMat(color), "gray": cv2.UMat(gray)} if gpu_ok else {}
        )
        inputs_cuda = (
            {"color": cuda_tasks.upload(color), "gray": cuda_tasks.upload(gray)}
            if cuda_ok
            else {}
        )

        for task_name in tasks:
            task: Task = TASKS[task_name]
            if progress:
                progress(f"{size_name} · {task.label}")

            m = Measurement(task=task.name, label=task.label, size=size_name)
            m.cpu_ms = _time_op(
                task.fn, inputs_cpu[task.input_kind], iterations, warmup, sync=False
            )

            if gpu_ok:
                try:
                    m.gpu_ms = _time_op(
                        task.fn, inputs_gpu[task.input_kind], iterations, warmup, sync=True
                    )
                except cv2.error as e:
                    m.gpu_error = str(e).splitlines()[0][:120]

            if cuda_ok:
                try:
                    fn = cuda_tasks.make(
                        task.name, inputs_cuda["color"], inputs_cuda["gray"]
                    )
                    m.cuda_ms = _time_op(
                        lambda _: fn(), None, iterations, warmup, sync=False
                    )
                except cuda_tasks.UnsupportedTask as e:
                    m.cuda_error = str(e)
                except cv2.error as e:
                    m.cuda_error = str(e).splitlines()[0][:120]

            result.measurements.append(m)

    return result
