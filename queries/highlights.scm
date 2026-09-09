; adapted from Zed's Python Config
; https://github.com/zed-industries/zed/blob/6657e301cd0ee9e7b7b5352957ef30728ae2a874/crates/languages/src/python/highlights.scm
; Identifiers default to variables; the more specific patterns below
; (properties, types, constants, functions, parameters) override this
; fallback because they appear later in the file.
(identifier) @variable

(attribute attribute: (identifier) @property)
(type (identifier) @type)
(inferred_attribute attribute: (identifier) @property)


; Function calls

(decorator) @function
(decorator
  (identifier) @function)

(call
  function: (attribute attribute: (identifier) @function.method))
(call
  function: (identifier) @function)

; Function definitions

(function_definition
  name: (identifier) @function)

; Type definitions

(class_definition
  name: (identifier) @type)
(trait_definition
  name: (identifier) @type)
(extension_definition
  name: (identifier) @type)
(type_alias_statement
  name: (identifier) @type)
(parameterized_alias_statement
  name: (identifier) @type)

; Parameters and named arguments. These sit before the naming-convention
; heuristics below so an upper-case compile-time parameter (the `T` in
; `def f[T: AnyType]`) still reads as a type.

(typed_parameter
  (identifier) @variable.parameter)
(convention_parameter
  (identifier) @variable.parameter)
(default_parameter
  name: (identifier) @variable.parameter)
(typed_default_parameter
  name: (identifier) @variable.parameter)
(constrained_parameter
  name: (identifier) @variable.parameter)
(variadic_type_parameter
  name: (identifier) @variable.parameter)
(keyword_argument
  name: (identifier) @variable.parameter)
(struct_literal_field
  name: (identifier) @property)

; Capture-list entries bind names from the enclosing scope.
(named_capture
  name: (identifier) @variable)

; Identifier naming conventions

((identifier) @type
 (#match? @type "^[A-Z]"))

((identifier) @constant
 (#match? @constant "^_*[A-Z][A-Z\\d_]*$"))

; Builtin functions

((call
  function: (identifier) @function.builtin)
 (#match?
   @function.builtin
   "^(abs|all|always_inline|any|ascii|bin|bool|breakpoint|bytearray|bytes|callable|chr|classmethod|compile|complex|constrained|delattr|dict|dir|divmod|enumerate|eval|filter|float|format|frozenset|getattr|globals|hasattr|hash|help|hex|id|input|int|isinstance|issubclass|iter|len|list|locals|map|max|memoryview|min|next|object|oct|open|ord|pow|print|property|range|repr|reversed|round|set|setattr|slice|sorted|staticmethod|str|sum|super|tuple|type|unroll|vars|zip|__mlir_attr|__mlir_op|__mlir_type|__import__)$"))

; Literals

[
  (none)
  (true)
  (false)
] @constant.builtin

"self" @variable.builtin

[
  (integer)
  (float)
] @number

(comment) @comment
(string) @string
(escape_sequence) @escape

[
  "("
  ")"
  "["
  "]"
  "{"
  "}"
] @punctuation.bracket

(interpolation
  "{" @punctuation.special
  "}" @punctuation.special) @embedded

; Docstrings.
(function_definition
  "async"?
  "def"
  name: (_)
  (parameters)?
  body: (block (expression_statement (string) @string.doc)))

[
  "-"
  "-="
  "!="
  "*"
  "**"
  "**="
  "*="
  "/"
  "//"
  "//="
  "/="
  "&"
  "%"
  "%="
  "^"
  "+"
  "->"
  "+="
  "<"
  "<<"
  "<="
  "<>"
  "="
  ":="
  "=="
  ">"
  ">="
  ">>"
  "|"
  "~"
  "^" ; capture-list move marker (var^ x)
  "and"
  "in"
  "is"
  "not"
  "or"
  "is not"
  "not in"
] @operator

[
  "as"
  "assert"
  "async"
  "await"
  "break"
  "class"
  "continue"
  "def"
  "elif"
  "else"
  "except"
  "finally"
  "for"
  "from"
  "if"
  "import"
  "lambda"
  "pass"
  "raise"
  "return"
  "struct"
  "trait"
  "try"
  "while"
  "with"
  "yield"
  "__match"
  "case"
  "where"
  "alias"
  "comptime"
  "__comptime_assert"
  "__extension"
  "__generator_type"
  "__mlir_region"
  "var"
  "ref"
  "Self"
  "abi"
  "capturing"
  "raises"
  "thin"
  "__param_trait__"
  "imm"
  "mut"
  "out"
  "deinit"
  "read"
] @keyword

(mlir_type "." @punctuation.special (#set! "priority" 110))
(mlir_type "," @punctuation (#set! "priority" 110))
(mlir_type) @type

; MLIR backtick fragments: the interior is tokenized so types, literals and
; operators inside the backticks are highlighted individually.
(mlir_fragment (type) @type (#set! "priority" 110))
(mlir_fragment (integer) @number (#set! "priority" 110))
(mlir_fragment (mlir_punctuation) @operator (#set! "priority" 110))
