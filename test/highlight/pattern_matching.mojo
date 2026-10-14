match command.split():
# ^ keyword
    case ["quit"]:
    # ^ keyword
        print("Goodbye!")
        quit_game()
    case ["look"]:
    # ^ keyword
        current_room.describe()
    case ["get", obj]:
    # ^ keyword
        character.get(obj, current_room)
    case ["go", direction]:
    # ^ keyword
        current_room = current_room.neighbor(direction)
    # The rest of your commands go here

match command.split():
# ^ keyword
    case ["drop", *objects]:
    # ^ keyword
        for obj in objects:
            character.drop(obj, current_room)

match command.split():
# ^ keyword
    case ["quit"]: ... # Code omitted for brevity
    case ["go", direction]: pass
    case ["drop", *objects]: pass
    case _:
        print(t"Sorry, I couldn't understand {command}")

match command.split():
# ^ keyword
    case ["north"] | ["go", "north"]:
    # ^ keyword
        current_room = current_room.neighbor("north")
    case ["get", obj] | ["pick", "up", obj] | ["pick", obj, "up"]:
    # ^ keyword
        pass

where = 2
#   ^ variable
where, a = 2, 3
#   ^ variable
total: Int = secret
#  ^ variable
x, where: str = 2, "hey, what's up?"
# <- variable
#   ^ variable

if result := re.fullmatch(r"(-)?(\d+:)?\d?\d:\d\d(\.\d*)?", time, flags=re.ASCII):
    #  ^ variable
    return result

__match legacy:
# ^ keyword
    case _:
        pass

match color:
# ^ keyword
    case .red:
    #     ^ constructor
        pass
    case Color.green:
        pass
    case .rgb(var r, _, _):
    #     ^ constructor
    #         ^ keyword
        pass
    case == expected:
    #    ^ operator
        pass
    case Point(x=0, y=var y):
    #          ^ property
        pass

if case .Some(ref value) = maybe:
# <- keyword
#  ^ keyword
#        ^ constructor
#             ^ keyword
    pass
elif case .None = maybe:
# <- keyword
#    ^ keyword
    pass

while case .Some(item) = it.next():
# <- keyword
#     ^ keyword
    pass

__enum Shade:
# <- keyword
#      ^ type
    case light
    # <- keyword
    #    ^ constructor
    case rgb(Int, Int, Int)
    #    ^ constructor
    #        ^ type

__enum Color:
    """A color."""
    # <- string.doc
    case red
    """Red."""
    # <- string.doc
