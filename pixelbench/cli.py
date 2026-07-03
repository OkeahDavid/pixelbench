"""pixelbench command-line interface."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from rich.console import Console

from . import __version__
from .tasks import SIZES, TASKS


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="pixelbench",
        description="Benchmark your CPU vs GPU on real image-processing workloads.",
    )
    parser.add_argument(
        "--sizes",
        default="720p,1080p,4k",
        help=f"comma-separated image sizes ({','.join(SIZES)}) [default: %(default)s]",
    )
    parser.add_argument(
        "--tasks",
        default=",".join(TASKS),
        help="comma-separated tasks to run [default: all]",
    )
    parser.add_argument(
        "--iterations", type=int, default=20, help="timed runs per op [default: 20]"
    )
    parser.add_argument(
        "--warmup", type=int, default=5, help="warmup runs per op [default: 5]"
    )
    parser.add_argument("--no-gpu", action="store_true", help="skip the GPU pass")
    parser.add_argument(
        "--json",
        type=Path,
        metavar="FILE",
        help="also save results as JSON (e.g. results/mine.json)",
    )
    parser.add_argument(
        "--leaderboard",
        action="store_true",
        help="print a markdown row to paste into the README leaderboard",
    )
    parser.add_argument("--version", action="version", version=f"pixelbench {__version__}")
    args = parser.parse_args(argv)

    sizes = [s.strip() for s in args.sizes.split(",") if s.strip()]
    tasks = [t.strip() for t in args.tasks.split(",") if t.strip()]
    for s in sizes:
        if s not in SIZES:
            parser.error(f"unknown size '{s}' (choose from: {', '.join(SIZES)})")
    for t in tasks:
        if t not in TASKS:
            parser.error(f"unknown task '{t}' (choose from: {', '.join(TASKS)})")

    console = Console()
    console.print(f"[bold cyan]pixelbench[/bold cyan] {__version__} — measuring, not guessing.\n")

    from .runner import run

    with console.status("[bold]benchmarking...[/bold]") as status:
        result = run(
            sizes=sizes,
            tasks=tasks,
            iterations=args.iterations,
            warmup=args.warmup,
            use_gpu=not args.no_gpu,
            progress=lambda msg: status.update(f"[bold]benchmarking[/bold] {msg}"),
        )

    from .report import leaderboard_row, print_report, save_json

    print_report(result, console)

    if args.json:
        path = save_json(result, args.json)
        console.print(f"\nResults saved to [bold]{path}[/bold]")

    if args.leaderboard:
        console.print("\n[bold]Leaderboard row[/bold] (paste into README.md):")
        console.print(leaderboard_row(result), highlight=False)

    return 0


if __name__ == "__main__":
    sys.exit(main())
