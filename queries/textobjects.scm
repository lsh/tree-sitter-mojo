; This Source Code Form is subject to the terms of the Mozilla Public
; License, v. 2.0. If a copy of the MPL was not distributed with this
; file, You can obtain one at https://mozilla.org/MPL/2.0/.
;
; Adapted from helix-editor/helix runtime/queries/python/textobjects.scm
; (rev 7275b7f85014aad7e15d4987ec4f2249572eecfb), with the Mojo
; declaration forms added.

(function_definition
  body: (block)? @function.inside) @function.around

; `struct` and `class` share class_definition in this grammar.
(class_definition
  body: (block)? @class.inside) @class.around

(trait_definition
  body: (block)? @class.inside) @class.around

(extension_definition
  body: (block)? @class.inside) @class.around

(parameters
  ((_) @parameter.inside . ","? @parameter.around) @parameter.around)

; Compile-time parameters: `def f[T: Copyable]()`
(type_parameter
  ((_) @parameter.inside . ","? @parameter.around) @parameter.around)

; Closure capture lists: `def f[x, y^]()`
(capture_list
  ((_) @parameter.inside . ","? @parameter.around) @parameter.around)

(argument_list
  ((_) @parameter.inside . ","? @parameter.around) @parameter.around)

(comment) @comment.inside

(comment)+ @comment.around

((function_definition
   name: (identifier) @_name
   body: (block)? @test.inside) @test.around
 (#match? @_name "^test_"))

(list
  (_) @entry.around)

(tuple
  (_) @entry.around)

(tuple_expression
  (_) @entry.around)

(set
  (_) @entry.around)

(struct_literal
  (_) @entry.around)

(pair
  (_) @entry.inside) @entry.around
