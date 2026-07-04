import json

import pytest

from pixelbench.cli import main


def test_full_cli_run_with_json_export(tiny_size, tmp_path, capsys):
    out_file = tmp_path / "results.json"
    code = main(
        [
            "--sizes", tiny_size,
            "--tasks", "grayscale,threshold",
            "--iterations", "2",
            "--warmup", "1",
            "--no-gpu",
            "--json", str(out_file),
        ]
    )
    assert code == 0
    data = json.loads(out_file.read_text())
    assert len(data["measurements"]) == 2
    out = capsys.readouterr().out
    assert "Grayscale conversion" in out
    assert "Results saved" in out


def test_unknown_size_is_rejected():
    with pytest.raises(SystemExit) as exc:
        main(["--sizes", "8k"])
    assert exc.value.code == 2


def test_unknown_task_is_rejected():
    with pytest.raises(SystemExit) as exc:
        main(["--tasks", "sharpen"])
    assert exc.value.code == 2


def test_version_flag():
    with pytest.raises(SystemExit) as exc:
        main(["--version"])
    assert exc.value.code == 0
