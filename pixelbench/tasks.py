"""Benchmark task definitions.

Each task is a single OpenCV operation applied identically on the CPU
(numpy array) and the GPU (cv2.UMat via OpenCV's transparent OpenCL API).
Tasks declare whether they consume the color or grayscale test image.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import cv2
import numpy as np


@dataclass(frozen=True)
class Task:
    name: str
    label: str
    input_kind: str  # "color" or "gray"
    fn: Callable


TASKS: dict[str, Task] = {
    t.name: t
    for t in [
        Task(
            "grayscale",
            "Grayscale conversion",
            "color",
            lambda img: cv2.cvtColor(img, cv2.COLOR_BGR2GRAY),
        ),
        Task(
            "gaussian_blur",
            "Gaussian blur 15x15",
            "color",
            lambda img: cv2.GaussianBlur(img, (15, 15), 0),
        ),
        Task(
            "median_blur",
            "Median blur 5x5",
            "color",
            lambda img: cv2.medianBlur(img, 5),
        ),
        Task(
            "bilateral",
            "Bilateral filter d=9",
            "color",
            lambda img: cv2.bilateralFilter(img, 9, 75, 75),
        ),
        Task(
            "threshold",
            "Binary threshold",
            "gray",
            lambda img: cv2.threshold(img, 127, 255, cv2.THRESH_BINARY)[1],
        ),
        Task(
            "sobel",
            "Sobel edges",
            "gray",
            lambda img: cv2.Sobel(img, cv2.CV_16S, 1, 1),
        ),
        Task(
            "canny",
            "Canny edges",
            "gray",
            lambda img: cv2.Canny(img, 100, 200),
        ),
        Task(
            "resize_half",
            "Resize to 50%",
            "color",
            lambda img: cv2.resize(img, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA),
        ),
    ]
}

SIZES: dict[str, tuple[int, int]] = {
    "720p": (1280, 720),
    "1080p": (1920, 1080),
    "1440p": (2560, 1440),
    "4k": (3840, 2160),
}


def make_test_image(width: int, height: int, seed: int = 42) -> np.ndarray:
    """Generate a deterministic synthetic photo-like test image.

    A blend of smooth gradients, shapes, and noise — so filters see both
    flat regions and edges, like a real photograph, and every machine
    benchmarks the exact same pixels.
    """
    rng = np.random.default_rng(seed)
    x = np.linspace(0, 255, width, dtype=np.float32)
    y = np.linspace(0, 255, height, dtype=np.float32)
    xx, yy = np.meshgrid(x, y)
    img = np.stack([xx, yy, (xx + yy) / 2], axis=-1).astype(np.uint8)

    for _ in range(40):
        center = (int(rng.integers(0, width)), int(rng.integers(0, height)))
        radius = int(rng.integers(10, max(11, min(width, height) // 8)))
        color = tuple(int(c) for c in rng.integers(0, 256, 3))
        cv2.circle(img, center, radius, color, -1)

    noise = rng.integers(-15, 16, img.shape, dtype=np.int16)
    return np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)
