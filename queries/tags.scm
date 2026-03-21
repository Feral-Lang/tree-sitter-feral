; ── Function definitions assigned to variables ────────────────────────────────
;   let myFunc = fn(...) { ... }
(var_decl_statement
  (var_bind
    name: (identifier) @name
    value: (fn_def)))  @definition.function

; ── Method definitions (keyed let binding) ────────────────────────────────────
;   let .myMethod = fn(...) { ... }
(var_decl_statement
  (var_bind
    name: (atom) @name
    value: (fn_def)))  @definition.method

; ── Variable declarations ─────────────────────────────────────────────────────
(var_decl_statement
  (var_bind
    name: (identifier) @name))  @definition.var

; ── Function calls ────────────────────────────────────────────────────────────
(call_expression
  function: (identifier) @name)  @reference.call

(call_expression
  function: (member_expression
    property: (identifier) @name))  @reference.call
