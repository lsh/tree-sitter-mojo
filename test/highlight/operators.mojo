a &= b
# ^ operator
a |= b
# ^ operator
a ^= b
# ^ operator
a <<= b
# ^ operator
a >>= b
# ^ operator
a @= b
# ^ operator
c = a @ b
#     ^ operator
x.y
#^ punctuation.delimiter
del x
# <- keyword


@always_inline
# <- function
def g():
    global counter
    # <- keyword
    nonlocal other
    # <- keyword
    pass
