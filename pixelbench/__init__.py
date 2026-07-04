"""pixelbench — benchmark your CPU vs GPU on real image-processing workloads."""

from importlib.metadata import PackageNotFoundError, version

try:
    __version__ = version("pixelbench")
except PackageNotFoundError:  # running from source without installation
    __version__ = "0.0.0"
