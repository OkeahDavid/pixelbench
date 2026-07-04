"""CUDA implementations of the benchmark tasks (cv2.cuda module).

These require an OpenCV build compiled with CUDA support and an NVIDIA GPU —
the standard opencv-python wheel from PyPI does not include the CUDA module.
Availability is detected at runtime; when absent, the CUDA pass is skipped.

Timing note: cv2.cuda calls on the default (null) stream block until the
device work completes, so wall-clock timing around each call is sound.

Stateful operators (filters, edge detectors) are created once per task in
the factory, outside the timed region, mirroring how a real pipeline would
reuse them across frames.
"""

from __future__ import annotations

import cv2


class UnsupportedTask(Exception):
    """Raised when a task has no CUDA implementation."""


def available() -> bool:
    try:
        return cv2.cuda.getCudaEnabledDeviceCount() > 0
    except (AttributeError, cv2.error):
        return False


def device_name() -> str | None:
    if not available():
        return None
    try:
        return cv2.cuda.DeviceInfo(0).name()
    except (AttributeError, cv2.error):
        return None


def upload(array) -> "cv2.cuda.GpuMat":
    mat = cv2.cuda.GpuMat()
    mat.upload(array)
    return mat


def make(task: str, color: "cv2.cuda.GpuMat", gray: "cv2.cuda.GpuMat"):
    """Return a zero-argument callable running `task` on pre-uploaded inputs."""
    if task == "grayscale":
        return lambda: cv2.cuda.cvtColor(color, cv2.COLOR_BGR2GRAY)

    if task == "gaussian_blur":
        f = cv2.cuda.createGaussianFilter(cv2.CV_8UC3, cv2.CV_8UC3, (15, 15), 0)
        return lambda: f.apply(color)

    if task == "median_blur":
        # cv2.cuda.createMedianFilter accepts single-channel input only,
        # which would not be comparable with the 3-channel CPU/OpenCL runs.
        raise UnsupportedTask("CUDA median filter is single-channel only")

    if task == "bilateral":
        return lambda: cv2.cuda.bilateralFilter(color, 9, 75, 75)

    if task == "threshold":
        return lambda: cv2.cuda.threshold(gray, 127, 255, cv2.THRESH_BINARY)[1]

    if task == "sobel":
        f = cv2.cuda.createSobelFilter(cv2.CV_8UC1, cv2.CV_16S, 1, 1)
        return lambda: f.apply(gray)

    if task == "canny":
        det = cv2.cuda.createCannyEdgeDetector(100.0, 200.0)
        return lambda: det.detect(gray)

    if task == "resize_half":
        w, h = color.size()
        return lambda: cv2.cuda.resize(
            color, (w // 2, h // 2), interpolation=cv2.INTER_AREA
        )

    raise UnsupportedTask(f"no CUDA implementation for '{task}'")
