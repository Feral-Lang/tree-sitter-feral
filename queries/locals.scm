; ── Scopes ────────────────────────────────────────────────────────────────────
(source_file) @local.scope
(block)       @local.scope
(fn_def)      @local.scope

; ── Definitions ───────────────────────────────────────────────────────────────
(var_bind name: (identifier) @local.definition)
(fn_param name: (identifier) @local.definition.parameter)
(for_in_statement variable: (identifier) @local.definition)

; ── References ────────────────────────────────────────────────────────────────
(identifier) @local.reference
