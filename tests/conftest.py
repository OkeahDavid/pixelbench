import pytest

from pixelbench.tasks import SIZES


@pytest.fixture
def tiny_size():
    """Register a small image size so integration tests run in milliseconds.

    SIZES is a module-level dict shared by tasks, runner, and cli, so
    mutating it here affects all of them; the fixture removes it afterwards.
    """
    SIZES["tiny"] = (64, 48)
    yield "tiny"
    del SIZES["tiny"]
