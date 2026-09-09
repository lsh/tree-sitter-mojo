struct Counter(Movable):
# <- keyword
#      ^ type
    var count: Int

    def bump(mut self, step: Int = 1) -> Int:
    # <- keyword
    #   ^ function
    #            ^ variable.builtin
    #                  ^ variable.parameter
        self.count += step
        return self.count


trait Bumpable:
# <- keyword
#     ^ type
    def bump(mut self, step: Int) -> Int:
        ...


__extension Counter(Bumpable):
# <- keyword
#           ^ type
    comptime Extra = Int
    # <- keyword


def main():
    var c = Counter(count=0)
    #                 ^ variable.parameter
    _ = c.bump(step=2)
    #            ^ variable.parameter
