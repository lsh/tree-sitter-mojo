; adapted from tree-sitter-python's tags.scm

; Definitions

(class_definition
  name: (identifier) @name) @definition.class

(trait_definition
  name: (identifier) @name) @definition.trait

(extension_definition
  name: (identifier) @name) @definition.class

(function_definition
  name: (identifier) @name) @definition.function

; References

(call
  function: (identifier) @name) @reference.call

(call
  function: (attribute
    attribute: (identifier) @name)) @reference.call
