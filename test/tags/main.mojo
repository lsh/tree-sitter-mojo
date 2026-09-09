struct MyClass:
#        ^ definition.class
    def hello(self):
#        ^ definition.function
        print("hello from MyClass")

def main():
#    ^ definition.function
    print("Hello, world!")

MyClass.hello()
#        ^ reference.call

main()
# <- reference.call

trait Greeter:
#     ^ definition.trait
    def hello(self):
        ...

__extension MyClass(Greeter):
#           ^ definition.class
    def greet(self):
#        ^ definition.function
        self.hello()
