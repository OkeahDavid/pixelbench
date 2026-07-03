"""Render benchmark results: terminal tables, JSON export, leaderboard rows."""

from __future__ import annotations

import json
import platform
from datetime import datetime, timezone
from pathlib import Path

from rich.console import Console
from rich.table import Table

from .runner import BenchmarkResult


def print_report(result: BenchmarkResult, console: Console | None = None) -> None:
    console = console or Console()
    sys = result.system

    console.print()
    console.print(
        f"[bold]CPU:[/bold] {sys['cpu']} ({sys['cores']} threads)   "
        f"[bold]GPU:[/bold] {sys['gpu']}"
        + (f" [{sys['gpu_type']}]" if sys.get("gpu_type") else "")
    )
    console.print(
        f"[dim]{sys['os']} · Python {sys['python']} · OpenCV {sys['opencv']} · "
        f"median of {result.iterations} runs, {result.warmup} warmup[/dim]\n"
    )

    sizes = list(dict.fromkeys(m.size for m in result.measurements))
    for size in sizes:
        table = Table(title=f"[bold]{size}[/bold]", title_justify="left")
        table.add_column("Task")
        table.add_column("CPU (ms)", justify="right")
        table.add_column("GPU (ms)", justify="right")
        table.add_column("GPU speedup", justify="right")

        for m in (m for m in result.measurements if m.size == size):
            if m.gpu_error:
                gpu_cell, speed_cell = "[dim]unsupported[/dim]", "—"
            elif m.gpu_ms is None:
                gpu_cell, speed_cell = "[dim]n/a[/dim]", "—"
            else:
                gpu_cell = f"{m.gpu_ms:.2f}"
                s = m.speedup
                color = "green" if s >= 1.1 else "red" if s <= 0.9 else "yellow"
                speed_cell = f"[{color}]{s:.2f}x[/{color}]"
            table.add_row(m.label, f"{m.cpu_ms:.2f}", gpu_cell, speed_cell)

        console.print(table)
        console.print()

    wins = [m for m in result.measurements if m.speedup and m.speedup > 1.1]
    total = [m for m in result.measurements if m.speedup]
    if total:
        console.print(
            f"[bold]Verdict:[/bold] GPU won {len(wins)}/{len(total)} tasks "
            f"on this machine. Faster hardware isn't always faster — "
            f"it depends on the task and image size."
        )


def to_dict(result: BenchmarkResult) -> dict:
    return {
        "pixelbench": _version(),
        "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "system": result.system,
        "iterations": result.iterations,
        "warmup": result.warmup,
        "measurements": [
            {
                "task": m.task,
                "size": m.size,
                "cpu_ms": m.cpu_ms,
                "gpu_ms": m.gpu_ms,
                "speedup": round(m.speedup, 3) if m.speedup else None,
                "gpu_error": m.gpu_error,
            }
            for m in result.measurements
        ],
    }


def save_json(result: BenchmarkResult, path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(to_dict(result), indent=2))
    return path


def leaderboard_row(result: BenchmarkResult) -> str:
    """One markdown table row, ready to paste into the README leaderboard."""
    sys = result.system
    speedups = [m.speedup for m in result.measurements if m.speedup]
    if not speedups:
        return "(no GPU results to report)"
    best = max(
        (m for m in result.measurements if m.speedup), key=lambda m: m.speedup
    )
    import numpy as np

    return (
        f"| {sys['cpu']} | {sys['gpu']} | {platform.system()} "
        f"| {np.median(speedups):.2f}x | {best.speedup:.2f}x ({best.label}, {best.size}) |"
    )


def _version() -> str:
    from . import __version__

    return __version__
