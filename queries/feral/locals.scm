; Scopes
(source_file) @local.scope
(braced_block) @local.scope
(fn_def) @local.scope

; Definitions
(var_bind name: (identifier) @local.definition)
(fn_param name: (identifier) @local.definition)

; References
(identifier) @local.reference