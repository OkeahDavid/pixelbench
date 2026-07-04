import numpy as np

from pixelbench.tasks import TASKS, make_test_image


def test_test_image_is_deterministic():
    a = make_test_image(64, 48)
    b = make_test_image(64, 48)
    assert np.array_equal(a, b)


def test_test_image_shape_and_dtype():
    img = make_test_image(64, 48)
    assert img.shape == (48, 64, 3)
    assert img.dtype == np.uint8


def test_different_seeds_differ():
    assert not np.array_equal(
        make_test_image(64, 48, seed=1), make_test_image(64, 48, seed=2)
    )


def _inputs():
    import cv2

    color = make_test_image(64, 48)
    gray = cv2.cvtColor(color, cv2.COLOR_BGR2GRAY)
    return {"color": color, "gray": gray}


def test_every_task_runs_and_returns_array():
    inputs = _inputs()
    for task in TASKS.values():
        out = task.fn(inputs[task.input_kind])
        assert isinstance(out, np.ndarray), task.name
        assert out.size > 0, task.name


def test_grayscale_output_is_single_channel():
    out = TASKS["grayscale"].fn(_inputs()["color"])
    assert out.ndim == 2


def test_threshold_output_is_binary():
    out = TASKS["threshold"].fn(_inputs()["gray"])
    assert set(np.unique(out)).issubset({0, 255})


def test_resize_halves_dimensions():
    out = TASKS["resize_half"].fn(_inputs()["color"])
    assert out.shape[:2] == (24, 32)


def test_blur_preserves_shape():
    inputs = _inputs()
    for name in ("gaussian_blur", "median_blur", "bilateral"):
        out = TASKS[name].fn(inputs["color"])
        assert out.shape == inputs["color"].shape, name
