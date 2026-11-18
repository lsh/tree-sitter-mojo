if foo():
# <- keyword
    pass
    # <- keyword
elif bar():
# <- keyword
    pass
else:
# <- keyword
    foo

return
# ^ keyword
raise e
# ^ keyword

for i in foo():
# <- keyword
#   ^ variable
#     ^ operator
#        ^ function
    continue
    # <- keyword
    break
    # <- keyword

a and b or c
# ^ operator
#     ^ variable
#       ^ operator

__async def lane() -> None:
# <- keyword
#       ^ keyword
    __await f()
    # <- keyword
