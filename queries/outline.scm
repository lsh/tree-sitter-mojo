(class_definition
    ["class" "struct"] @context
    name: (identifier) @name
    ) @item

(function_definition
    "async"? @context
    "def" @context
    name: (_) @name) @item

(trait_definition
    "trait" @context
    name: (identifier) @name) @item

(extension_definition
    "__extension" @context
    name: (_) @name) @item

; Compile-time constants read as top-level declarations in an outline.
(parameterized_alias_statement
    "comptime" @context
    name: (identifier) @name) @item
