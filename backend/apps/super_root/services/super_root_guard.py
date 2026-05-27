from contextlib import contextmanager
from threading import local


_state = local()


def _stack():
    if not hasattr(_state, "allow_super_root_mutation"):
        _state.allow_super_root_mutation = []
    return _state.allow_super_root_mutation


def is_super_root_mutation_allowed():
    return bool(_stack())


@contextmanager
def allow_super_root_mutation(*, reason="validated"):
    stack = _stack()
    stack.append(reason)
    try:
        yield
    finally:
        stack.pop()
