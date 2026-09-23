; This Source Code Form is subject to the terms of the Mozilla Public
; License, v. 2.0. If a copy of the MPL was not distributed with this
; file, You can obtain one at https://mozilla.org/MPL/2.0/.
;
; Adapted from helix-editor/helix runtime/queries/python/locals.scm
; (rev 7275b7f85014aad7e15d4987ec4f2249572eecfb), with the Mojo
; declaration forms added.

;; Scopes

[
  (module)
  (function_definition)
  (lambda)
] @local.scope

;; Definitions

; Parameters
(parameters
  (identifier) @local.definition)
(parameters
  (typed_parameter
    (identifier) @local.definition))
(parameters
  (default_parameter
    name: (identifier) @local.definition))
(parameters
  (typed_default_parameter
    name: (identifier) @local.definition))
(parameters
  (list_splat_pattern ; *args
    (identifier) @local.definition))
(parameters
  (dictionary_splat_pattern ; **kwargs
    (identifier) @local.definition))

; Argument conventions (`read x`, `mut x`, `out x`, ...) wrap the binding.
(parameters
  (convention_parameter
    (identifier) @local.definition))

; Compile-time parameters: `def f[T: Copyable]()`
(type_parameter
  (identifier) @local.definition)

; Closure captures: `def f[x, y^]()`
(named_capture
  name: (identifier) @local.definition)

; Imports
(import_statement
  name: (dotted_name
    (identifier) @local.definition))

; `import a as b`
(aliased_import
  (identifier) @local.definition)

;; References

(identifier) @local.reference
