"""Collect system information for benchmark reports."""

from __future__ import annotations

import os
import platform
import sys

import cv2


def _cpu_name() -> str:
    """Return a human-readable CPU name across platforms."""
    system = platform.system()
    if system == "Windows":
        try:
            import winreg

            key = winreg.OpenKey(
                winreg.HKEY_LOCAL_MACHINE,
                r"HARDWARE\DESCRIPTION\System\CentralProcessor\0",
            )
            name, _ = winreg.QueryValueEx(key, "ProcessorNameString")
            return name.strip()
        except OSError:
            pass
    elif system == "Linux":
        try:
            with open("/proc/cpuinfo") as f:
                for line in f:
                    if line.startswith("model name"):
                        return line.split(":", 1)[1].strip()
        except OSError:
            pass
    elif system == "Darwin":
        try:
            import subprocess

            return subprocess.check_output(
                ["sysctl", "-n", "machdep.cpu.brand_string"], text=True
            ).strip()
        except (OSError, subprocess.CalledProcessError):
            pass
    return platform.processor() or "Unknown CPU"


def opencl_device() -> dict:
    """Return info about the default OpenCL device, or availability flags."""
    info = {
        "available": bool(cv2.ocl.haveOpenCL()),
        "name": None,
        "vendor": None,
        "type": None,
    }
    if not info["available"]:
        return info
    cv2.ocl.setUseOpenCL(True)
    if not cv2.ocl.useOpenCL():
        info["available"] = False
        return info
    dev = cv2.ocl.Device_getDefault()
    info["name"] = dev.name().strip()
    info["vendor"] = dev.vendorName().strip()
    info["type"] = "iGPU" if dev.hostUnifiedMemory() else "dGPU"
    return info


def collect() -> dict:
    """Gather everything worth recording alongside benchmark numbers."""
    from . import cuda_tasks

    ocl = opencl_device()
    cuda = cuda_tasks.available()
    return {
        "cpu": _cpu_name(),
        "cores": os.cpu_count(),
        "gpu": ocl["name"] or "None (OpenCL unavailable)",
        "gpu_vendor": ocl["vendor"],
        "gpu_type": ocl["type"],
        "opencl": ocl["available"],
        "cuda": cuda,
        "cuda_device": cuda_tasks.device_name() if cuda else None,
        "os": f"{platform.system()} {platform.release()}",
        "python": sys.version.split()[0],
        "opencv": cv2.__version__,
    }
