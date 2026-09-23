"""Module docstring."""
# <- string.doc


def f():
    """Function docstring."""
    # <- string.doc
    var s = "not a docstring"
    #       ^ string
    "also not a docstring"
    # <- string


struct S:
    """Struct docstring."""
    # <- string.doc
    var x: Int


trait T:
    """Trait docstring."""
    # <- string.doc
    def f(self): ...
