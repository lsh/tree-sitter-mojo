/**
 * @file Mojo grammar for tree-sitter
 * @author Lukas Hermann <1734032+lsh@users.noreply.github.com>
 * @license MIT
 * @see {@link https://docs.modular.com/mojo/manual/|Mojo manual}
 *
 * Based on the tree-sitter-python grammar:
 * @author Max Brunsfeld <maxbrunsfeld@gmail.com>
 * @see {@link https://github.com/tree-sitter/tree-sitter-python}
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const PREC = {
  // this resolves a conflict between the usage of ':' in a lambda vs in a
  // typed parameter. In the case of a lambda, we don't allow typed parameters.
  lambda: -2,
  typed_parameter: -1,
  conditional: -1,

  parenthesized_expression: 1,
  parenthesized_list_splat: 1,
  or: 10,
  and: 11,
  not: 12,
  compare: 13,
  bitwise_or: 14,
  bitwise_and: 15,
  xor: 16,
  shift: 17,
  plus: 18,
  times: 19,
  unary: 20,
  power: 21,
  call: 22,
};

const SEMICOLON = ';';
const SELF = 'self';

// Hard keywords, mirroring the reference compiler's TokenKinds.def. `fn`
// was removed from the language and is NOT a keyword: it is an ordinary
// identifier here (`var fn = 2` parses cleanly). The magic reflection
// words (`origin_of`, `type_of`, `conforms_to`, `__functions_in_module`, ...)
// are keywords in the compiler but are deliberately NOT reserved here: they
// behave like ordinary call targets, and reserving them would break parsing
// of perfectly valid code for no structural gain.
const HARD_KEYWORDS = [
  // Python-inherited keywords still present in Mojo.
  'False', 'await', 'else', 'import', 'pass',
  'None', 'break', 'except', 'in', 'raise',
  'True', 'class', 'finally', 'is', 'return',
  'and', 'continue', 'for', 'lambda', 'try',
  'as', 'def', 'from', 'nonlocal', 'while',
  'assert', 'del', 'global', 'not', 'with',
  'async', 'elif', 'if', 'or', 'yield',
  // Mojo-specific keywords.
  'Self', 'alias', 'case', 'comptime', 'match', 'ref', 'struct',
  'trait', 'var',
  '__comptime_assert', '__extension', '__generator_type', '__match',
  '__mlir_region',
];

// Contextual (soft) keywords: the argument-convention words (`imm`, `mut`,
// `out`, `var` is hard, `deinit`, `read` is deprecated), the function-effect
// words (`raises`, `capturing`, `thin`, `abi`), and `where`. None of these are
// reserved: they remain valid ordinary identifiers (`var mut = 5` is legal),
// which is why the grammar below admits them via `alias(...)` in the few
// positions where the compiler reads them as keywords.
const SOFT_KEYWORDS = [
  'abi', 'capturing', 'deinit', 'imm', 'mut', 'out', 'raises', 'read',
  'thin', 'where',
];

// The convention words that may appear as parameter names in `[...]`
// parameter lists, as bare parameter arguments (`unsafe_mut_cast[mut]`), or
// as parameter default values (`mut=mut`).
const SOFT_CONVENTIONS = ['mut', 'out', 'imm', 'read', 'deinit'];

module.exports = grammar({
  name: 'mojo',

  extras: ($) => [
    $.comment,
    /[\s\f\uFEFF\u2060\u200B]|\r?\n/,
    $.line_continuation,
  ],

  conflicts: ($) => [
    [$.parameter_list, $.subscript],
    // `x[mut, mut]` — a subscript list of bare convention words vs a
    // subscript with a repeat boundary.
    [$.subscript, $.primary_expression],
    [$.primary_expression, $.pattern],
    [$.primary_expression, $.list_splat_pattern],
    // `(*a)` reads as a tuple of one splat or a parenthesized splat
    // expression; the tuple reading wins (matching Python's grammar).
    [$.primary_expression, $._collection_elements],
    // `*x as y` in an `as_pattern` vs a starred `as_pattern` operand.
    [$.list_splat, $.as_pattern],
    // `for mut in mut:` — a convention on the loop variable vs an identifier
    // loop variable named `mut` (the convention reading wins via dynamic
    // precedence in the for_statement rule).
    [$.argument_convention, $.primary_expression],
    // `f(*a)` — a call with a splat argument, or a call on a parenthesized
    // splat expression (the argument-list reading wins via precedence below).
    [$.argument_list, $.primary_expression],
    // `f[*a](b)` — a parametric instantiation with splats vs a subscript.
    [$.parameter_list, $.primary_expression],
    // A superclass list containing a splat vs a splat expression.
    [$.superclass_list, $.primary_expression],
    // `__extension X(` — the conformance list vs a call on the extended name.
    [$.extension_definition, $.primary_expression],
    // `for var x in ...` — the loop convention vs a `binding_pattern` loop
    // variable (the convention reading wins via dynamic precedence).
    [$.binding_pattern, $.argument_convention],
    // `var a, b = ...` — the leading `var` scopes the whole pattern list, not
    // just its first element.
    [$.binding_pattern, $.pattern_list],
    // `var x: Int = 1` — the leading `var` belongs to the assignment, not to
    // a `binding_pattern` target.
    [$.binding_pattern, $.assignment],
    // `for ref [a, b] in ...` — a `ref[origin]` convention vs a `ref` binding
    // of a list pattern.
    [$._ref_convention, $._collection_elements],
    [$.tuple, $.tuple_pattern],
    [$.list, $.list_pattern],
    [$.with_item, $._collection_elements],
    [$.named_expression, $.as_pattern],
    [$.transfer_expression, $.binary_operator],
    [$.transfer_expression, $.binary_operator, $.unary_operator],
    [$.transfer_expression, $.binary_operator, $.await],
    [$.type_parameter, $.list],
    // `__generator_type[Int] Int` — the brackets are the parameter clause, not
    // a list literal standing as the body type.
    [$.type, $._collection_elements],
    // `lambda [mut, ...]` — a soft-keyword parameter name in a type parameter
    // list vs the identifier reading of the same word.
    [$.type_parameter, $.primary_expression],
    // `mut=mut` in a type parameter default — the default may be the bare
    // convention word (an origin parameter reference) or an identifier.
    [$._type_parameter_default, $.primary_expression],
    [$.parameterized_alias_statement, $.primary_expression],
    [$._collection_elements, $.struct_literal],
    // `with x as a, b:` — the alias may be a pattern list of several names.
    [$.with_item, $.pattern_list],
    // A call result may be an assignment target (`node[].right() = x`), so it
    // also reads as an expression in `with x as f():`.
    [$.with_item, $.primary_expression],
    // The repeat boundary of `pattern_list`, e.g. `with x as a, b:`.
    [$.pattern_list],
    // `raises E[X]` is a generic type, not an identifier plus an origin set
    // (the generic reading wins via dynamic precedence).
    [$._raises_type, $.primary_expression],
  ],

  supertypes: ($) => [
    $._simple_statement,
    $._compound_statement,
    $.expression_statement,
    $.expression,
    $.primary_expression,
    $.pattern,
    $.parameter,
  ],

  externals: ($) => [
    $._newline,
    $._indent,
    $._dedent,
    $.string_start,
    $._string_content,
    $.escape_interpolation,
    $.string_end,

    // Mark comments as external tokens so that the external scanner is always
    // invoked, even if no external token is expected. This allows for better
    // error recovery, because the external scanner can maintain the overall
    // structure by returning dedent tokens whenever a dedent occurs, even
    // if no dedent is expected.
    $.comment,

    // Allow the external scanner to check for the validity of closing brackets
    // so that it can avoid returning dedent tokens between brackets.
    ']',
    ')',
    '}',
    'except',
  ],

  inline: ($) => [
    $._simple_statement,
    $._compound_statement,
    $._suite,
    $._expressions,
    $._left_hand_side,
  ],

  reserved: {
    // Globally reserved words, as in the compiler's lexer: none of these may
    // ever read as an identifier (`var match = 2` is a parse error, matching
    // the compiler's "expected name for 'var' declaration"). Note that
    // keyword tokens are still explicitly accepted as attribute names after
    // a dot (`x.def`), mirroring the compiler's member-name parser. Soft
    // keywords are not reserved: they stay usable as ordinary identifiers.
    global: _ => HARD_KEYWORDS,
  },

  word: ($) => $.identifier,

  rules: {
    module: ($) => repeat($._statement),

    // Tokens for reserved words no other rule mentions: the removed Python
    // statements (`del`, `global`, `nonlocal`). The `reserved` set requires
    // every reserved word to exist as a token in a reachable rule, but these
    // words must never actually parse: the NUL byte cannot occur in source
    // text, so any occurrence of one of them is guaranteed to produce a
    // parse error, matching the compiler's rejection. (`fn` is NOT reserved:
    // it was removed from the language and now reads as an ordinary
    // identifier.)
    _removed_keyword: (_) => seq(choice('del', 'global', 'nonlocal'), '\0'),

    _statement: ($) =>
      choice($._simple_statements, $._compound_statement, $._removed_keyword),

    // Simple statements

    _simple_statements: ($) =>
      seq(
        sep1($._simple_statement, SEMICOLON),
        optional(SEMICOLON),
        $._newline,
      ),

    _simple_statement: ($) =>
      choice(
        $.import_statement,
        $.import_from_statement,
        $.assert_statement,
        $.comptime_assert_statement,
        $.expression_statement,
        $.return_statement,
        $.raise_statement,
        $.pass_statement,
        $.break_statement,
        $.continue_statement,
        $.type_alias_statement,
        $.parameterized_alias_statement,
      ),

    import_statement: ($) => seq('import', $._import_list),

    import_prefix: (_) => repeat1('.'),

    relative_import: ($) =>
      seq($.import_prefix, optional(alias($.module_path, $.dotted_name))),

    // A module path. Unlike a `dotted_name` — which also spells out match-case
    // patterns, where a bare string is a literal pattern — a component here may
    // be a backtick-quoted raw identifier (lexed as a string), e.g.
    // ``from `renamed-package`.module import identity``.
    module_path: ($) => prec(1, sep1(choice($.identifier, $.string), '.')),

    import_from_statement: ($) =>
      seq(
        'from',
        field('module_name', choice(
          $.relative_import,
          alias($.module_path, $.dotted_name),
        )),
        'import',
        choice(
          $.wildcard_import,
          $._import_list,
          seq('(', $._import_list, ')'),
        ),
      ),

    _import_list: ($) =>
      seq(
        commaSep1(field('name', choice(
          $.dotted_name,
          // A relative import using `import`, e.g. `import .warp`.
          $.relative_import,
          $.aliased_import,
        ))),
        optional(','),
      ),

    aliased_import: ($) =>
      seq(field('name', $.dotted_name), 'as', field('comptime', $.identifier)),

    wildcard_import: (_) => '*',

    assert_statement: ($) =>
      seq(optional('comptime'), 'assert', commaSep1($.expression)),

    comptime_assert_statement: ($) => seq('__comptime_assert', $.expression),

    expression_statement: ($) =>
      choice(
        $.expression,
        $.tuple_expression,
        $.assignment,
        $.augmented_assignment,
        $.yield,
      ),

    tuple_expression: ($) =>
      seq($.expression, ',', optional(seq(commaSep1($.expression), optional(',')))),

    named_expression: ($) =>
      seq(
        // The target is a storable address, so a member, an index or a tuple
        // of them is allowed too, e.g. `print(field.value := 1, f())`,
        // `print(reference[0] := 1, f())` and `print((a, b) := (1, 2), f())`.
        field('name', choice($.identifier, $.attribute, $.subscript, $.tuple)),
        ':=',
        field('value', $.expression),
      ),

    return_statement: ($) => seq('return', optional($._expressions)),

    _expressions: ($) => choice($.expression, $.expression_list),

    raise_statement: ($) =>
      seq(
        'raise',
        optional($._expressions),
        optional(seq('from', field('cause', $.expression))),
      ),

    pass_statement: (_) => prec.left('pass'),
    break_statement: (_) => prec.left('break'),
    continue_statement: (_) => prec.left('continue'),

    // Compound statements

    _compound_statement: ($) => choice(
      $.if_statement,
      $.for_statement,
      $.while_statement,
      $.try_statement,
      $.with_statement,
      $.function_definition,
      $.class_definition,
      $.trait_definition,
      $.decorated_definition,
      $.match_statement,
      $.comptime_statement,
      $.mlir_region,
      $.extension_definition,
    ),

    // An extension declaration, e.g. `__extension List:` or
    // `__extension List[T]:`.
    extension_definition: ($) =>
      seq(
        '__extension',
        field('name', choice($.identifier, $.subscript)),
        // The traits the extension conforms the type to, e.g.
        //   __extension MyStruct(Convertible):
        field(
          'superclasses',
          optional(alias($.superclass_list, $.argument_list)),
        ),
        repeat($.where_clause),
        ':',
        field('body', $._suite),
      ),

    // An MLIR region declaration, e.g.
    //   __mlir_region await_body(hdl: __mlir_type.`!co.routine`):
    //       body(hdl)
    mlir_region: ($) =>
      seq(
        '__mlir_region',
        field('name', $.identifier),
        field('parameters', $.parameters),
        ':',
        field('body', $._suite),
      ),

    // A compile-time control-flow statement, e.g. `comptime if ...:` or
    // `comptime for ... in ...:`. (`comptime assert` is parsed by
    // assert_statement above.)
    comptime_statement: ($) => seq(
      'comptime',
      choice($.if_statement, $.for_statement),
    ),

    if_statement: ($) =>
      seq(
        'if',
        field('condition', $.expression),
        ':',
        field('consequence', $._suite),
        repeat(field('alternative', $.elif_clause)),
        optional(field('alternative', $.else_clause)),
      ),

    elif_clause: ($) =>
      seq(
        'elif',
        field('condition', $.expression),
        ':',
        field('consequence', $._suite),
      ),

    else_clause: ($) => seq('else', ':', field('body', $._suite)),

    // The experimental match statement is spelled `__match` in the current
    // compiler (TokenKinds: `__match` // Experimental match statement). The
    // plain `match` keyword is reserved but has no statement rule yet.
    match_statement: ($) =>
      seq(
        '__match',
        commaSep1(field('subject', $.expression)),
        optional(','),
        ':',
        field('body', alias($._match_block, $.block)),
      ),

    _match_block: ($) =>
      choice(
        seq($._indent, repeat(field('alternative', $.case_clause)), $._dedent),
        $._newline,
      ),

    case_clause: ($) =>
      seq(
        'case',
        commaSep1($.case_pattern),
        optional(','),
        optional(field('guard', $.if_clause)),
        ':',
        field('consequence', $._suite),
      ),

    for_statement: ($) =>
      seq(
        'for',
        // The loop variable may carry a convention, e.g. `for var arg in ...`
        // or `for ref item in ...`. Dynamic precedence favors the convention
        // reading of `for mut in mut:` over the identifier reading.
        optional(prec.dynamic(1, $.argument_convention)),
        field('left', $._left_hand_side),
        'in',
        field('right', $._expressions),
        ':',
        field('body', $._suite),
        field('alternative', optional($.else_clause)),
      ),

    while_statement: ($) =>
      seq(
        'while',
        field('condition', $.expression),
        ':',
        field('body', $._suite),
        optional(field('alternative', $.else_clause)),
      ),

    try_statement: ($) =>
      seq(
        'try',
        ':',
        field('body', $._suite),
        repeat($.except_clause),
        optional($.else_clause),
        optional($.finally_clause),
      ),

    except_clause: ($) =>
      seq(
        'except',
        optional(
          seq($.expression, optional(seq(choice('as', ','), $.expression))),
        ),
        ':',
        $._suite,
      ),

    finally_clause: ($) => seq('finally', ':', $._suite),

    with_statement: ($) =>
      seq(
        'with',
        $.with_clause,
        ':',
        field('body', $._suite),
      ),

    with_clause: ($) =>
      choice(
        seq(commaSep1($.with_item), optional(',')),
        seq('(', commaSep1($.with_item), optional(','), ')'),
      ),

    with_item: ($) => prec.dynamic(1, seq(
      field('value', $.expression),
      optional(seq('as', field('alias', $._left_hand_side))),
    )),

    function_definition: ($) => seq(
      optional('async'),
      'def',
      // A backtick-quoted raw identifier (lexed as a string) may name a
      // definition, e.g. ``def `import`():``.
      field('name', choice($.identifier, $.string)),
      field('type_parameters', optional($.type_parameter)),
      field('parameters', $.parameters),
      optional($._function_effects),
      // A nested def may declare a capture list, e.g.
      //   def body(i: Int) {mut count}: ...
      optional($.capture_list),
      optional(
        seq(
          '->',
          optional($._ref_convention),
          field('return_type', $.type),
        ),
      ),
      repeat($.where_clause),
      ':',
      field('body', $._suite),
    ),

    // A function's effect qualifiers, in any order and combination:
    //   raises [ErrorType]  — may carry a thrown type
    //   capturing           — legacy parametric closure marker
    //   thin                — function-pointer types (types only, but
    //                         tolerated everywhere for error recovery)
    //   abi("C") / abi("Mojo")
    // `raises` may carry an optional thrown type, bound greedily so a
    // following `->`/`:`/`|`/`.` is treated as part of the type when present.
    _function_effects: ($) => repeat1(choice(
      seq('raises', optional(field('raises_type', alias($._raises_type, $.type)))),
      'capturing',
      'thin',
      // Experimental marker on function types, e.g.
      //   struct Foo[T: Writable](def(x: T) __param_trait__):
      '__param_trait__',
      $.abi_specifier,
    )),

    abi_specifier: ($) => seq('abi', '(', $.string, ')'),

    // The thrown type after `raises` is a primary-level expression (a dotted
    // name, a parametric type like `Errors[X]`, or a parenthesized union) —
    // never a bare `constrained_type`, whose `:` would otherwise swallow the
    // function body colon in `def f() raises HALError:`. Member access is
    // spelled out directly (rather than as a general attribute chain) so the
    // full expression grammar stays out of the effect clause.
    _raises_type: ($) => choice(
      prec(1, $.identifier),
      // Dynamic precedence so `raises E[X]` reads as a parametric type rather
      // than a bare identifier followed by an origin set (see the declared
      // `_raises_type`/`subscript` conflict).
      prec.dynamic(1, $.subscript),
      $.self_type,
      $.parenthesized_expression,
      prec(1, seq(
        choice($.identifier, $.self_type),
        repeat1(seq('.', $.identifier)),
      )),
    ),

    // A unified-closure capture list, e.g. `{mut count}`, `{imm}`,
    // `{var x, imm}`, `{var^ moved}` or `{}`. Only nested defs, lambdas and
    // legacy `capturing` closures may carry one. A bare convention (with no
    // name) sets the default for all unlisted captures.
    capture_list: ($) =>
      seq(
        '{',
        optional(seq(
          commaSep1(choice($.named_capture, $.default_capture)),
          optional(','),
        )),
        '}',
      ),

    named_capture: ($) =>
      seq(
        optional(choice('mut', 'imm', 'read', 'ref', 'var')),
        field('name', $.identifier),
        // `var x^` moves the captured value into the closure.
        optional('^'),
      ),

    default_capture: ($) =>
      choice('mut', 'imm', 'read', 'ref', seq('var', optional('^'))),

    // The bracketed origin set of a function type, e.g. the `[_]` in
    // `def() capturing[_] -> None`.
    origin_set: ($) =>
      prec(PREC.call + 1,
        seq('[', commaSep1(choice($.expression, $.wildcard_origin)), optional(','), ']')),

    wildcard_origin: (_) => '_',

    parameters: ($) => seq(
      '(',
      optional($._parameters),
      ')',
    ),

    // A starred expression in an argument/collection position, e.g. `f(*a)`,
    // `[*a.b]`. The star may prefix any expression; pattern contexts use
    // `list_splat_pattern` instead.
    list_splat: ($) => seq(
      '*',
      $.expression,
    ),

    dictionary_splat: ($) => seq(
      '**',
      $.expression,
    ),

    type_alias_statement: ($) => prec.dynamic(1, seq(
      'alias',
      field('name', $.identifier),
      optional(seq(':', field('type', $.type))),
      '=',
      field('value', $._right_hand_side),
    )),

    // A parameterized compile-time constant, e.g.
    //   comptime Ptr[mut: Bool, //, origin: Origin[mut=mut] = Default] = Value
    parameterized_alias_statement: ($) => prec.dynamic(1, seq(
      'comptime',
      field('name', $.identifier),
      field('type_parameters', $.type_parameter),
      // An optional trait/type bound on the alias, e.g.
      //   comptime It[...]: Iterator = Self
      optional(seq(':', field('type', $.type))),
      // Trailing constraints, e.g.
      //   comptime P[a: T] where conforms_to(T, Equatable) = rebind[...](a)
      repeat($.where_clause),
      // A trait may declare an associated alias with no value, e.g.
      //   comptime IteratorType[origin: Origin[...]]: Iterator
      optional(seq('=', field('value', $._right_hand_side))),
    )),

    // A struct definition. (`class` is accepted for error recovery; the
    // compiler parses it but diagnoses "classes are not supported yet".)
    class_definition: ($) => seq(
      choice('class', 'struct'),
      field('name', $.identifier),
      field('type_parameters', optional($.type_parameter)),
      field(
        'superclasses',
        optional(alias($.superclass_list, $.argument_list)),
      ),
      repeat($.where_clause),
      ':',
      field('body', $._suite),
    ),

    // A struct conformance list, like an argument list except each entry may
    // carry trailing `where` constraints, e.g.
    //   struct Tuple[*Ts: Movable](Copyable where AllCopyable[*Ts], Defaultable):
    superclass_list: ($) =>
      seq(
        '(',
        optional(
          commaSep1(
            seq(
              choice(
                $.expression,
                $.list_splat,
                $.dictionary_splat,
                alias($.parenthesized_list_splat, $.parenthesized_expression),
                $.keyword_argument,
                // A callable-type conformance, e.g. the last entry in
                //   ](ImplicitlyCopyable, RegisterPassable, def() -> None):
                $.function_type,
              ),
              repeat($.where_clause),
            ),
          ),
        ),
        optional(','),
        ')',
      ),

    // The `[...]` parameter clause of a function, struct, or alias, also reused
    // for generic-type instantiation. Empty brackets are permitted.
    type_parameter: ($) => seq(
      '[',
      optional(seq(
        commaSep1(choice(
          $.infer_separator,
          $.keyword_separator,
          $.positional_separator,
          // Variadic parameters, e.g. `*Ts: AnyType` or `*Ts`.
          seq(
            '*',
            alias(choice(...SOFT_CONVENTIONS), $.identifier),
            optional(seq(':', field('type', $.type))),
            optional(seq('=', field('default', $._type_parameter_default))),
          ),
          // Argument-convention soft keywords (`mut`, `out`, ...) used as
          // parameter names, e.g. `mut: Bool` or `mut=mut`.
          seq(
            alias(choice(...SOFT_CONVENTIONS), $.identifier),
            optional(seq(':', field('type', $.type))),
            optional(seq('=', field('default', $._type_parameter_default))),
          ),
          // A named parameter with a constraint, e.g. the `T: AnyType` in
          // `def f[T: AnyType](x: T)` or the variadic `*Ts: AnyType` in
          // `def g[*Ts: AnyType]()`. The compiler parses these as named
          // parameters (ParsedArgument: `name ':' type`), never as a
          // `type: type` expression. Convention words (`mut: Bool`) are
          // handled by the alternatives above: they lex as keywords.
          $.constrained_parameter,
          seq(
            $.type,
            optional(seq('=', field('default', $._type_parameter_default))),
          ),
        )),
        optional(','),
      )),
      ']',
    ),

    // A type-parameter default may be any expression (covering parametric
    // instantiations and call chains like `Target[x].options()`), or a bare
    // convention keyword such as `mut` referencing an origin parameter.
    _type_parameter_default: ($) =>
      choice($.expression, alias(choice(...SOFT_CONVENTIONS), $.identifier)),

    // A named parameter with a constraint in a `[...]` parameter list,
    // e.g. the `T: AnyType` in `def f[T: AnyType](x: T)` or the `*Ts: AnyType`
    // in `def g[*Ts: AnyType]()`. (Bare `*Ts` without a constraint parses as
    // a `list_splat` expression instead.)
    constrained_parameter: ($) => seq(
      optional('*'),
      field('name', $.identifier),
      ':',
      field('type', $.type),
      optional(seq('=', field('default', $._type_parameter_default))),
    ),

    // The `//` marker separating infer-only parameters from explicit ones.
    infer_separator: (_) => '//',

    trait_definition: ($) => seq(
      'trait',
      field('name', $.identifier),
      field('type_parameters', optional($.type_parameter)),
      field('supertraits', optional($.trait_list)),
      repeat($.where_clause),
      ':',
      field('body', seq($._indent, $.block)),
    ),

    // A supertrait list. Entries are a plain name, a dotted path
    // (`std.traits.Deinitable`) or a parametric trait (`Iterator[T]`), each
    // optionally carrying trailing `where` constraints — the same shape as a
    // struct's conformance list.
    trait_list: ($) => seq(
      '(',
      optional(commaSep1(seq(
        // A callable type may stand as a supertrait, e.g.
        //   trait DefinesClosure(def(z: Int) -> Int):
        choice($.expression, $.function_type),
        repeat($.where_clause),
      ))),
      optional(','),
      ')',
    ),

    parenthesized_list_splat: ($) => prec(PREC.parenthesized_list_splat, seq(
      '(',
      choice(
        alias($.parenthesized_list_splat, $.parenthesized_expression),
        $.list_splat,
      ),
      ')',
    )),

    argument_list: ($) => seq(
      '(',
      optional(commaSep1(
        choice(
          $.expression,
          $.list_splat,
          $.dictionary_splat,
          alias($.parenthesized_list_splat, $.parenthesized_expression),
          $.keyword_argument,
          // `var`/`ref` are prefix operators binding a single subexpression
          // (ParserExprs kVarPat/kRefPat), e.g. the argument in
          // `SMemArray[UInt128, stages](ref smem.clc_response)`.
          $.binding_pattern,
        ),
      )),
      optional(','),
      ')',
    ),

    parameter_list: ($) => seq(
      '[',
      optional(commaSep1(
        choice(
          seq($.expression),
          $.list_splat,
          $.dictionary_splat,
          alias($.parenthesized_list_splat, $.parenthesized_expression),
          $.keyword_argument,
          // A callable type argument, e.g. `val.isa[def() -> Path]()`.
          $.function_type,
        ),
      )),
      optional(','),
      ']',
    ),

    decorated_definition: ($) => seq(
      repeat1($.decorator),
      field('definition', choice(
        $.class_definition,
        $.function_definition,
        $.trait_definition,
        // A decorated comptime alias, e.g.
        //   @deprecated(use=ImplicitlyDeletable)
        //   comptime X = ImplicitlyDeletable
        seq($.assignment, $._newline),
        seq($.parameterized_alias_statement, $._newline),
        seq($.type_alias_statement, $._newline),
        // A decorated import, e.g.
        //   @__doc_inline
        //   from .src import InlinedStruct
        seq($.import_statement, $._newline),
        seq($.import_from_statement, $._newline),
      )),
    ),

    decorator: ($) => seq('@', $.expression, $._newline),

    _suite: ($) =>
      choice(
        alias($._simple_statements, $.block),
        seq($._indent, $.block),
        alias($._newline, $.block),
      ),

    block: ($) => seq(repeat($._statement), $._dedent),

    expression_list: ($) =>
      prec.right(
        seq(
          $.expression,
          choice(',', seq(repeat1(seq(',', $.expression)), optional(','))),
        ),
      ),

    dotted_name: ($) => prec(1, sep1($.identifier, '.')),

    // Match cases

    case_pattern: ($) =>
      prec(
        1,
        choice(
          alias($._as_pattern, $.as_pattern),
          $.keyword_pattern,
          $._simple_pattern,
        ),
      ),

    _simple_pattern: ($) =>
      prec(
        1,
        choice(
          $.class_pattern,
          $.splat_pattern,
          $.union_pattern,
          alias($._list_pattern, $.list_pattern),
          alias($._tuple_pattern, $.tuple_pattern),
          $.dict_pattern,
          $.string,
          $.concatenated_string,
          $.true,
          $.false,
          $.none,
          seq(optional('-'), choice($.integer, $.float)),
          $.complex_pattern,
          $.dotted_name,
          '_',
        ),
      ),

    _as_pattern: ($) => seq($.case_pattern, 'as', $.identifier),

    union_pattern: ($) =>
      prec.right(
        seq($._simple_pattern, repeat1(prec.left(seq('|', $._simple_pattern)))),
      ),

    _list_pattern: ($) =>
      seq('[', optional(seq(commaSep1($.case_pattern), optional(','))), ']'),

    _tuple_pattern: ($) =>
      seq('(', optional(seq(commaSep1($.case_pattern), optional(','))), ')'),

    dict_pattern: ($) =>
      seq(
        '{',
        optional(
          seq(
            commaSep1(choice($._key_value_pattern, $.splat_pattern)),
            optional(','),
          ),
        ),
        '}',
      ),

    _key_value_pattern: ($) =>
      seq(field('key', $._simple_pattern), ':', field('value', $.case_pattern)),

    keyword_pattern: ($) => seq($.identifier, '=', $._simple_pattern),

    splat_pattern: ($) =>
      prec(1, seq(choice('*', '**'), choice($.identifier, '_'))),

    class_pattern: ($) =>
      seq(
        $.dotted_name,
        '(',
        optional(seq(commaSep1($.case_pattern), optional(','))),
        ')',
      ),

    complex_pattern: ($) =>
      prec(
        1,
        seq(
          optional('-'),
          choice($.integer, $.float),
          choice('+', '-'),
          choice($.integer, $.float),
        ),
      ),

    // Patterns

    _parameters: ($) => seq(commaSep1($.parameter), optional(',')),

    _patterns: ($) => seq(commaSep1($.pattern), optional(',')),

    parameter: ($) =>
      choice(
        $.self_parameter,
        $.identifier,
        $.typed_parameter,
        // An untyped parameter carrying a convention, e.g. `mut count` or
        // `var **list` (diagnosed later by the compiler, but valid syntax).
        $.convention_parameter,
        $.default_parameter,
        $.typed_default_parameter,
        $.list_splat_pattern,
        $.tuple_pattern,
        $.keyword_separator,
        $.positional_separator,
        $.dictionary_splat_pattern,
      ),

    // Soft keywords remain valid binding names in assignment targets, e.g.
    // `mut = 5` or `var where: Int`. The keyword tokens must be accepted
    // explicitly: the lexer only demotes a keyword to the word token when no
    // active GLR branch accepts the keyword token, and the
    // `primary_expression` alias below keeps the keyword valid whenever an
    // expression may start, which includes every statement start.
    pattern: ($) =>
      choice(
        $.identifier,
        alias(choice(...SOFT_KEYWORDS), $.identifier),
        $.subscript,
        $.attribute,
        $.list_splat_pattern,
        $.tuple_pattern,
        $.list_pattern,
        $.binding_pattern,
      ),

    // A binding declaration inside a destructuring pattern, e.g. the second
    // element of `_, var r = udivmod_unchecked(...)`, the `(var left),
    // (var right)` of a tuple destructuring, or `for var i, var x in ...`.
    // Dynamic precedence keeps a leading `var`/`ref` attached to the
    // enclosing `assignment` or `for_statement` instead.
    binding_pattern: ($) =>
      prec.dynamic(-1, seq(choice('var', 'ref'), $.pattern)),

    tuple_pattern: ($) => seq('(', optional($._patterns), ')'),

    list_pattern: ($) => seq('[', optional($._patterns), ']'),

    // The `ref` origin convention, optionally carrying one or more arguments,
    // e.g. `ref[origin]` or `ref[origin, address_space]`.
    _ref_convention: ($) =>
      prec(1, seq('ref', '[', commaSep1($.expression), optional(','), ']')),

    // Argument conventions. `imm` is the implicit default; `read` is a
    // deprecated synonym of `imm` (still diagnosed by the compiler, parsed
    // here for graceful recovery). `borrowed`, `inout` and `owned` were
    // removed and are no longer parsed.
    argument_convention: ($) =>
      choice(
        'imm',
        'mut',
        'out',
        'var',
        'deinit',
        'read',
        'ref',
        $._ref_convention,
      ),

    where_clause: ($) => seq('where', $.expression),

    self_parameter: ($) =>
      prec.right(seq(
        optional($.argument_convention),
        SELF,
        optional(seq(':', field('type', $.type))),
      )),

    convention_parameter: ($) =>
      prec(
        PREC.typed_parameter,
        seq(
          $.argument_convention,
          choice(
            $.identifier,
            $.list_splat_pattern,
            $.dictionary_splat_pattern,
          ),
        ),
      ),

    typed_parameter: ($) =>
      prec(
        PREC.typed_parameter,
        seq(
          seq(
            optional($.argument_convention),
            choice(
              $.identifier,
              $.list_splat_pattern,
              $.dictionary_splat_pattern,
            ),
          ),
          ':',
          field('type', $.type),
        ),
      ),

    default_parameter: ($) =>
      seq(
        field('name', choice($.identifier, $.tuple_pattern)),
        '=',
        field('value', $.expression),
      ),

    typed_default_parameter: ($) =>
      prec(
        PREC.typed_parameter,
        seq(
          optional($.argument_convention),
          field('name', $.identifier),
          ':',
          field('type', $.type),
          '=',
          field('value', $.expression),
        ),
      ),

    list_splat_pattern: ($) =>
      seq(
        '*',
        choice($.identifier, $.subscript, $.attribute),
      ),

    dictionary_splat_pattern: ($) =>
      seq(
        '**',
        choice($.identifier, $.subscript, $.attribute),
      ),

    // Extended patterns (patterns allowed in match statement are far more flexible than simple patterns though still a subset of "expression")

    as_pattern: ($) =>
      prec.left(
        seq(
          $.expression,
          'as',
          field('comptime', alias($.expression, $.as_pattern_target)),
        ),
      ),

    // Expressions

    _expression_within_for_in_clause: ($) =>
      choice($.expression, alias($.lambda_within_for_in_clause, $.lambda)),

    expression: ($) =>
      choice(
        $.comparison_operator,
        $.not_operator,
        $.boolean_operator,
        $.lambda,
        $.primary_expression,
        $.conditional_expression,
        $.named_expression,
        $.as_pattern,
      ),

    primary_expression: ($) =>
      choice(
        $.await,
        $.binary_operator,
        $.identifier,
        // Soft keywords are not reserved, so each also reads as an ordinary
        // identifier in expression position, e.g. `f(mut)`, `x = capturing`.
        // Keyword extraction makes the keyword token win over the word rule,
        // so an explicit alternative is required here (and wherever a soft
        // keyword may appear as a name).
        alias(choice(...SOFT_KEYWORDS), $.identifier),
        $.string,
        $.concatenated_string,
        $.integer,
        $.float,
        $.true,
        $.false,
        $.none,
        $.self_type,
        $.unary_operator,
        $.transfer_expression,
        $.attribute,
        $.inferred_attribute,
        choice(prec.dynamic(-1, $.subscript), prec.dynamic(1, $.call)),
        $.list,
        $.list_comprehension,
        $.dictionary,
        $.dictionary_comprehension,
        $.set,
        $.set_comprehension,
        $.struct_literal,
        $.tuple,
        $.parenthesized_expression,
        $.generator_expression,
        $.ellipsis,
        $.list_splat,
        $.comptime_expression,
      ),

    // `comptime` applied to a parenthesized expression in value position, e.g.
    // `result[i] = comptime (StaticString(raw[i]))`.
    comptime_expression: ($) =>
      prec(PREC.call, seq('comptime', $.parenthesized_expression)),

    // The postfix transfer/consume operator, e.g. `result^`.
    transfer_expression: ($) =>
      prec(PREC.call, seq(field('value', $.primary_expression), '^')),

    not_operator: ($) =>
      prec(PREC.not, seq('not', field('argument', $.expression))),

    boolean_operator: ($) =>
      choice(
        prec.left(
          PREC.and,
          seq(
            field('left', $.expression),
            field('operator', 'and'),
            field('right', $.expression),
          ),
        ),
        prec.left(
          PREC.or,
          seq(
            field('left', $.expression),
            field('operator', 'or'),
            field('right', $.expression),
          ),
        ),
      ),

    binary_operator: ($) => {
      const table = [
        [prec.left, '+', PREC.plus],
        [prec.left, '-', PREC.plus],
        [prec.left, '*', PREC.times],
        [prec.left, '@', PREC.times],
        [prec.left, '/', PREC.times],
        [prec.left, '%', PREC.times],
        [prec.left, '//', PREC.times],
        [prec.right, '**', PREC.power],
        [prec.left, '|', PREC.bitwise_or],
        [prec.left, '&', PREC.bitwise_and],
        [prec.left, '^', PREC.xor],
        [prec.left, '<<', PREC.shift],
        [prec.left, '>>', PREC.shift],
      ];

      // @ts-ignore
      return choice(
        ...table.map(([fn, operator, precedence]) =>
          fn(
            precedence,
            seq(
              field('left', $.primary_expression),
              // @ts-ignore
              field('operator', operator),
              field('right', $.primary_expression),
            ),
          ),
        ),
      );
    },

    unary_operator: ($) =>
      prec(
        PREC.unary,
        seq(
          field('operator', choice('+', '-', '~')),
          field('argument', $.primary_expression),
        ),
      ),

    _not_in: (_) => seq('not', 'in'),

    _is_not: (_) => seq('is', 'not'),

    comparison_operator: ($) =>
      prec.left(
        PREC.compare,
        seq(
          $.primary_expression,
          repeat1(
            seq(
              field(
                'operators',
                choice(
                  '<',
                  '<=',
                  '==',
                  '!=',
                  '>=',
                  '>',
                  '<>',
                  'in',
                  alias($._not_in, 'not in'),
                  'is',
                  alias($._is_not, 'is not'),
                ),
              ),
              $.primary_expression,
            ),
          ),
        ),
      ),

    // A lambda expression with typed, parenthesized parameters, e.g.
    //   lambda (x: Int) -> Int: x + 1
    //   lambda: 42
    // optionally with compile-time parameters, effects, a capture list and a
    // result type, mirroring a nested def's signature:
    //   lambda (x: Int) raises {mut count} -> Int: f(x, count)
    lambda: ($) =>
      prec(
        PREC.lambda,
        seq(
          'lambda',
          field('parameters', optional($.type_parameter)),
          optional($.parameters),
          optional($._function_effects),
          optional($.capture_list),
          optional(seq('->', optional($._ref_convention), field('return_type', $.type))),
          ':',
          field('body', $.expression),
        ),
      ),

    lambda_within_for_in_clause: ($) =>
      prec(
        PREC.lambda,
        seq(
          'lambda',
          field('parameters', optional($.type_parameter)),
          optional($.parameters),
          optional($._function_effects),
          optional($.capture_list),
          optional(seq('->', optional($._ref_convention), field('return_type', $.type))),
          ':',
          field('body', $._expression_within_for_in_clause),
        ),
      ),

    assignment: ($) =>
      seq(
        optional(choice('var', 'comptime', 'ref')),
        field('left', $._left_hand_side),
        choice(
          seq('=', field('right', $._right_hand_side)),
          seq(':', field('type', $.type)),
          seq(
            ':',
            field('type', $.type),
            // Trailing constraints on a `comptime` alias, e.g.
            //   comptime It: Iterator where conforms_to(Self.T, Movable) = X
            repeat($.where_clause),
            '=',
            field('right', $._right_hand_side),
          ),
        ),
      ),

    augmented_assignment: ($) =>
      seq(
        field('left', $._left_hand_side),
        field(
          'operator',
          choice(
            '+=',
            '-=',
            '*=',
            '/=',
            '@=',
            '//=',
            '%=',
            '**=',
            '>>=',
            '<<=',
            '&=',
            '^=',
            '|=',
          ),
        ),
        field('right', $._right_hand_side),
      ),

    // A backtick-quoted (raw) identifier used as a binding name lexes as a
    // (string), e.g. ``var `6bit` = ...`` or ``comptime `\x1e` = ...``. A call
    // result may also be an assignment target, e.g. `self.get(i) = x` or
    // `node[].right() = other`.
    _left_hand_side: ($) => choice($.pattern, $.pattern_list, $.string, $.call),

    pattern_list: ($) =>
      seq(
        $.pattern,
        choice(',', seq(repeat1(seq(',', $.pattern)), optional(','))),
      ),

    _right_hand_side: ($) =>
      choice(
        $.expression,
        $.expression_list,
        $.assignment,
        $.augmented_assignment,
        $.pattern_list,
        $.yield,
        // A callable type as the value, e.g. `comptime F = def() -> None`, the
        // parenthesized `comptime F = (def[n: Int](x: Int) -> None)`, or an
        // intersection ending in one, e.g.
        // `comptime RowBody = ImplicitlyCopyable & RegisterPassable & (
        //      def[_p: ContextParams](Coord, mut Context[_p]) -> None
        //  )`.
        $.function_type,
        alias($.parenthesized_function_type, $.parenthesized_expression),
        $.intersection_type,
      ),

    yield: ($) =>
      prec.right(
        seq(
          'yield',
          choice(seq('from', $.expression), optional($._expressions)),
        ),
      ),

    attribute: ($) =>
      prec(
        PREC.call,
        seq(
          field('object', $.primary_expression),
          '.',
          choice(
            field('attribute', choice(
              $.identifier,
              alias(choice(...HARD_KEYWORDS, ...SOFT_KEYWORDS), $.identifier),
            )),
            // A backtick-quoted raw identifier (lexed as a string) may name a
            // member, e.g. the `pop.cast` in ``__mlir_op.`pop.cast` ``.
            field('attribute', $.string),
          ),
        ),
      ),

    // A contextually inferred member reference, e.g. `.red` in
    // `takes_color(.red)` or `.hsb_to_rgb(120, 100, 50)`. The base type is
    // inferred from context; postfix operations (calls, subscripts, further
    // attribute chains) apply as usual.
    inferred_attribute: ($) =>
      prec(
        PREC.call,
        seq(
          '.',
          field('attribute', choice(
            $.identifier,
            alias(choice(...HARD_KEYWORDS, ...SOFT_KEYWORDS), $.identifier),
          )),
        ),
      ),

    subscript: ($) =>
      prec(
        PREC.call,
        seq(
          field('value', $.primary_expression),
          '[',
          // Empty brackets are allowed for parametric instantiation, e.g.
          // `_CString[]`, where every parameter is inferred or defaulted.
          optional(seq(
            commaSep1(field('subscript', choice(
              $.expression,
              $.slice,
              $.keyword_argument,
              // A keyword argument whose value is a slice, e.g. `x[byte=1:n]`.
              alias($.slice_keyword_argument, $.keyword_argument),
              // A callable type argument, e.g. `Variant[def() -> Path]` or
              // `Some[ImplicitlyCopyable & (def() raises)]`.
              $.function_type,
              $.intersection_type,
              // A bare convention keyword used as a parameter argument, e.g.
              // the `mut` in `unsafe_mut_cast[mut]`.
              alias(choice(...SOFT_CONVENTIONS), $.identifier),
            ))),
            optional(','),
          )),
          ']',
        ),
      ),

    slice: ($) =>
      seq(
        optional($.expression),
        ':',
        optional($.expression),
        optional(seq(':', optional($.expression))),
      ),

    ellipsis: (_) => '...',

    call: ($) =>
      prec(
        PREC.call,
        seq(
          field('function', $.primary_expression),
          optional($.parameter_list),
          field('arguments', choice($.generator_expression, $.argument_list)),
        ),
      ),

    // A type expression. Mojo spells types with the expression grammar: a
    // parametric instantiation is a `subscript` (`List[Int]`), a qualified name
    // an `attribute` (`Self.T`), a specialization-and-call a `call`
    // (`get_device_spec[0]()`), a union a `binary_operator` (`Int | None`), a
    // variadic a `list_splat` (`*Ts`), and parameter arithmetic an ordinary
    // `binary_operator` (`size_of[T]() * 2`). So `type` adds only the forms
    // that have no expression spelling. Re-deriving those constructs as
    // type-only rules is what used to double the parse table and make an
    // `intersection_type` unusable in value position.
    type: ($) => choice(
      $.expression,
      $.intersection_type,
      $.function_type,
      $.generator_type,
    ),

    // A callable type literal, e.g. `def(Int) raises -> Bool` or
    // `def() capturing -> Path`, usable anywhere a type is expected.
    // prec.right(1) lets a completed callable type reduce before a `:`
    // that belongs to the enclosing rule (e.g. the function-definition colon in
    // `def f() -> def() -> None:`) rather than being read as the start of a
    // constrained_type operand.
    function_type: ($) => prec.right(1, seq(
      optional('async'),
      'def',
      // A callable type may carry a compile-time parameter clause before its
      // value parameters, e.g. `def[width: Int, alignment: Int = 1](Coord)`.
      field('type_parameters', optional($.type_parameter)),
      // A callable type's parameters are types, optionally named, e.g.
      // `def(Int, OpaquePointer[X])` or `def(x: Int) -> None`, and may carry
      // an argument convention, e.g. `def(mut Bencher, T)`. The named form
      // takes precedence over reading `x: T` as a constrained type.
      '(',
      optional(seq(
        commaSep1(choice(
          // Positional/keyword/inferred separators, e.g. the `/` in
          // `def(Int, Int, /) thin -> Int`.
          $.infer_separator,
          $.keyword_separator,
          $.positional_separator,
          seq(
            optional($.argument_convention),
            choice(
              prec.dynamic(
                1,
                seq(
                  field('name', $.identifier),
                  ':',
                  field('parameter', $.type),
                ),
              ),
              // A named variadic parameter, e.g. the `* args: * PyArgs` and
              // `var ** kwargs: PythonObject` in
              // `def(* args: * PyArgs, var ** kwargs: PythonObject) raises`.
              $.variadic_type_parameter,
              field('parameter', $.type),
            ),
          ),
        )),
        optional(','),
      )),
      ')',
      optional($._function_effects),
      // A capture-origin set, e.g. `def() capturing[_] -> None`.
      optional($.origin_set),
      optional(seq(
        '->',
        optional($._ref_convention),
        field('return_type', $.type),
      )),
      repeat($.where_clause),
    )),

    // A generator type literal, e.g. `__generator_type[Int]` — the type of a
    // `yield`-producing function, parameterized by its element types.
    generator_type: ($) => prec.right(1, seq(
      '__generator_type',
      field('type_parameters', optional($.type_parameter)),
      field('body', $.type),
    )),

    variadic_type_parameter: ($) => prec.dynamic(2, seq(
      choice('*', '**'),
      field('name', $.identifier),
      ':',
      field('parameter', $.type),
    )),

    // The `&` intersection/conjunction type operator combining trait/types with
    // a callable type, e.g. `Copyable & RegisterPassable & def() -> None`. A
    // trailing `function_type` is required, so a plain `A & B` of identifiers
    // still parses as a `binary_operator`; only the presence of a `def` operand
    // selects the intersection reading.
    // The callable operand may sit last, e.g.
    // `Some[ImplicitlyCopyable & (def() raises)]`, or — when parenthesized —
    // first, e.g.
    // `closure_type: (def() -> None) & DevicePassable & ImplicitlyCopyable`.
    // A bare `def` only ever leads when it is the whole chain, since
    // `def() -> A & B` reads `A & B` as the result type.
    intersection_type: ($) =>
      prec.left(PREC.bitwise_and, choice(
        // The trait bounds are an ordinary `&` expression — `A & B & C` is a
        // `binary_operator` until a callable operand turns up — so the chain
        // shares the expression grammar instead of re-deriving it.
        seq(
          field('left', $.primary_expression),
          '&',
          field('right', $._callable_type_operand),
        ),
        seq(
          alias($.parenthesized_function_type, $.parenthesized_expression),
          repeat1(seq('&', $.primary_expression)),
        ),
      )),

    // A callable type, bare or parenthesized.
    _callable_type_operand: ($) => choice(
      $.function_type,
      alias($.parenthesized_function_type, $.parenthesized_expression),
    ),
    parenthesized_function_type: ($) => seq('(', $.function_type, ')'),

    // The `Self` type, referring to the enclosing struct/trait/extension.
    self_type: (_) => 'Self',

    // A subscript keyword argument whose value is a slice, e.g. `x[byte=1:n]`.
    // The name may be a convention soft keyword, e.g. the `mut` in
    // `Origin[mut=True]`.
    slice_keyword_argument: ($) =>
      seq(
        field('name', choice(
          $.identifier,
          alias(choice(...SOFT_CONVENTIONS), $.identifier),
        )),
        '=',
        field('value', $.slice),
      ),

    keyword_argument: ($) =>
      seq(
        field('name', choice(
          $.identifier,
          // Argument-convention soft keywords used as parameter names, e.g.
          // the `mut` in `Origin[mut=True]`.
          alias(choice(...SOFT_CONVENTIONS), $.identifier),
          // A backtick-quoted raw identifier (lexed as a string), e.g. the
          // ``llvm.target_cpu`` in ``@__llvm_metadata(`llvm.target_cpu`=X)``.
          $.string,
        )),
        '=',
        // The value may be a callable type, e.g. the `_type=` parameter in
        // ``__mlir_op.`co.resume`[_type=def(AnyCoroutine) thin -> None](h)``.
        field('value', choice($.expression, $.function_type)),
      ),

    // Literals

    list: ($) => seq('[', optional($._collection_elements), ']'),

    set: ($) => seq('{', $._collection_elements, '}'),

    tuple: ($) => seq('(', optional($._collection_elements), ')'),

    dictionary: ($) =>
      seq(
        '{',
        optional(commaSep1(choice($.pair, $.dictionary_splat))),
        optional(','),
        '}',
      ),

    pair: ($) =>
      seq(field('key', $.expression), ':', field('value', $.expression)),

    // A struct/initializer literal, e.g. `{ ptr = p, length = n }` or
    // `{ ctx, name = value }` mixing positional and named fields.
    struct_literal: ($) =>
      prec.dynamic(-1, seq(
        '{',
        commaSep1(choice($.struct_literal_field, $.expression)),
        optional(','),
        '}',
      )),

    struct_literal_field: ($) =>
      seq(
        field('name', $.identifier),
        '=',
        field('value', $.expression),
      ),

    list_comprehension: ($) =>
      seq('[', field('body', $.expression), $._comprehension_clauses, ']'),

    dictionary_comprehension: ($) =>
      seq('{', field('body', $.pair), $._comprehension_clauses, '}'),

    set_comprehension: ($) =>
      seq('{', field('body', $.expression), $._comprehension_clauses, '}'),

    generator_expression: ($) =>
      seq('(', field('body', $.expression), $._comprehension_clauses, ')'),

    _comprehension_clauses: ($) =>
      seq($.for_in_clause, repeat(choice($.for_in_clause, $.if_clause))),

    parenthesized_expression: ($) =>
      prec(
        PREC.parenthesized_expression,
        seq('(', choice($.expression, $.yield), ')'),
      ),

    _collection_elements: ($) =>
      seq(
        commaSep1(
          choice(
            $.expression,
            $.yield,
            $.list_splat,
            $.parenthesized_list_splat,
          ),
        ),
        optional(','),
      ),

    for_in_clause: ($) =>
      prec.left(
        seq(
          'for',
          optional($.argument_convention),
          field('left', $._left_hand_side),
          'in',
          field('right', commaSep1($._expression_within_for_in_clause)),
          optional(','),
        ),
      ),

    if_clause: ($) => seq('if', $.expression),

    conditional_expression: ($) =>
      prec.right(
        PREC.conditional,
        seq($.expression, 'if', $.expression, 'else', $.expression),
      ),

    concatenated_string: ($) => seq($.string, repeat1($.string)),

    string: ($) =>
      seq(
        $.string_start,
        repeat(choice($.interpolation, $.string_content)),
        $.string_end,
      ),

    string_content: ($) =>
      prec.right(
        repeat1(
          choice(
            $.escape_interpolation,
            $.escape_sequence,
            $._not_escape_sequence,
            $._string_content,
          ),
        ),
      ),

    // A t-string interpolation, e.g. the `{name}` in `t"hello {name}"`.
    // The compiler parses exactly one expression between the braces — no
    // format specifiers, type conversions, or self-documenting `=` (all are
    // hard parse errors: "format specifiers are not supported in t-strings").
    interpolation: ($) =>
      seq(
        '{',
        field('expression', $.expression),
        '}',
      ),

    escape_sequence: (_) =>
      token.immediate(
        prec(
          1,
          seq(
            '\\',
            choice(
              /u[a-fA-F\d]{4}/,
              /U[a-fA-F\d]{8}/,
              /x[a-fA-F\d]{2}/,
              /\d{1,3}/,
              /\r?\n/,
              /['"abfrntv\\]/,
            ),
          ),
        ),
      ),

    _not_escape_sequence: (_) => token.immediate('\\'),

    integer: (_) =>
      token(
        choice(
          seq(choice('0x', '0X'), repeat1(/_?[A-Fa-f0-9]+/), optional(/[Ll]/)),
          seq(choice('0o', '0O'), repeat1(/_?[0-7]+/), optional(/[Ll]/)),
          seq(choice('0b', '0B'), repeat1(/_?[0-1]+/), optional(/[Ll]/)),
          seq(
            repeat1(/[0-9]+_?/),
            choice(
              optional(/[Ll]/), // long numbers
              optional(/[jJ]/), // complex numbers
            ),
          ),
        ),
      ),

    float: (_) => {
      const digits = repeat1(/[0-9]+_?/);
      const exponent = seq(/[eE][\+-]?/, digits);

      return token(
        seq(
          choice(
            seq(digits, '.', optional(digits), optional(exponent)),
            seq(optional(digits), '.', digits, optional(exponent)),
            seq(digits, exponent),
          ),
          optional(/[jJ]/),
        ),
      );
    },

    identifier: (_) => /[_\p{XID_Start}][_\p{XID_Continue}]*/,

    true: (_) => 'True',
    false: (_) => 'False',
    none: (_) => 'None',

    await: ($) => prec(PREC.unary, seq('await', $.primary_expression)),

    comment: (_) => token(seq('#', /.*/)),

    line_continuation: (_) =>
      token(seq('\\', choice(seq(optional('\r'), '\n'), '\0'))),

    positional_separator: (_) => '/',
    keyword_separator: (_) => '*',
  },
});

module.exports.PREC = PREC;

/**
 * Creates a rule to match one or more of the rules separated by a comma
 *
 * @param {RuleOrLiteral} rule
 *
 * @returns {SeqRule}
 */
function commaSep1(rule) {
  return sep1(rule, ',');
}

/**
 * Creates a rule to match one or more occurrences of `rule` separated by `sep`
 *
 * @param {RuleOrLiteral} rule
 * @param {RuleOrLiteral} separator
 *
 * @returns {SeqRule}
 */
function sep1(rule, separator) {
  return seq(rule, repeat(seq(separator, rule)));
}
