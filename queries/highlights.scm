; ── Comments ────────────────────────────────────────────────────────────────
(block_comment) @comment.block
(line_comment)  @comment.line

; ── Keywords — control flow ──────────────────────────────────────────────────
[
  "if"
  "elif"
  "else"
  "for"
  "in"
  "while"
  "return"
  "continue"
  "break"
  "defer"
  "inline"
] @keyword.control

; ── Keywords — declaration ───────────────────────────────────────────────────
"let"  @keyword.declaration
"fn"   @keyword.declaration.function

; ── Keywords — error handling ────────────────────────────────────────────────
"or"   @keyword.operator

; ── Keywords — async ─────────────────────────────────────────────────────────
[
  "await"
  "wait"
  "yield"
] @keyword.control.async

; ── Language constants ────────────────────────────────────────────────────────
"true"  @constant.builtin.boolean
"false" @constant.builtin.boolean
"nil"   @constant.builtin

; ── Special compile-time identifiers ─────────────────────────────────────────
((identifier) @constant.macro
  (#match? @constant.macro "^__(SRC_PATH|SRC_DIR)__$"))

; ── Function definitions ─────────────────────────────────────────────────────
(fn_def
  (fn_param
    name: (identifier) @variable.parameter))

; ── Variable declarations ─────────────────────────────────────────────────────
(var_bind
  name: (identifier) @variable.declaration)

; ── Function calls ────────────────────────────────────────────────────────────
(call_expression
  function: (identifier) @function.call)
(call_expression
  function: (member_expression
    property: (identifier) @function.method.call))

; ── Identifiers ──────────────────────────────────────────────────────────────
(identifier) @variable

; ── Atoms (.name) ─────────────────────────────────────────────────────────────
(atom) @constant.other.symbol

; ── Strings ───────────────────────────────────────────────────────────────────
(string_literal) @string

; ── Numbers ───────────────────────────────────────────────────────────────────
(integer_literal) @constant.numeric.integer
(float_literal)   @constant.numeric.float

; ── Operators ─────────────────────────────────────────────────────────────────
(assignment_expression "=" @operator.assignment)
(compound_assign_expression operator: _ @operator.assignment.compound)
(ternary_expression ["?" ":"] @operator.ternary)
(nil_coalesce_expression "??" @operator.nil-coalesce)
(logical_or_expression  "||" @operator.logical)
(logical_and_expression "&&" @operator.logical)
(equality_expression   operator: _ @operator.comparison)
(relational_expression operator: _ @operator.relational)
(shift_expression      operator: _ @operator.bitwise.shift)
(additive_expression   operator: _ @operator.arithmetic)
(multiplicative_expression operator: _ @operator.arithmetic)
(bitwise_or_expression  "|" @operator.bitwise)
(bitwise_xor_expression "^" @operator.bitwise)
(bitwise_and_expression "&" @operator.bitwise)
(unary_prefix_expression  operator: _ @operator.prefix)
(unary_postfix_expression operator: _ @operator.postfix)
(member_expression operator: ["." "->"] @operator.member-access)

; ── Punctuation ───────────────────────────────────────────────────────────────
["{" "}"] @punctuation.bracket
["(" ")"] @punctuation.bracket
["[" "]"] @punctuation.bracket
","        @punctuation.separator
";"        @punctuation.terminator
