; Comments
(line_comment) @comment.line
(block_comment) @comment.block

; Keywords
"let" @keyword
"fn" @keyword.function
"if" @keyword.conditional
"elif" @keyword.conditional
"else" @keyword.conditional
"for" @keyword.repeat
"in" @keyword.operator
"while" @keyword.repeat
"return" @keyword.return
"yield" @keyword.return
"await" @keyword
"wait" @keyword
"continue" @keyword.repeat
"break" @keyword.repeat
"defer" @keyword
"inline" @keyword
"or" @keyword.operator
"void" @constant.builtin
"true" @boolean
"false" @boolean
"nil" @constant.builtin

; Literals
(integer_literal) @number
(float_literal) @number.float
(string_literal) @string
(atom) @string.special

; Variables and functions
(var_bind name: (identifier) @variable)
(fn_param name: (identifier) @variable.parameter)

; Function definitions used as variable values
(var_bind
  name: (identifier) @function
  value: (fn_def))

; Function calls
(call_expr
  . (identifier) @function.call)
(call_expr
  . (member_expr
    member: (identifier) @function.method))

; Member access
(member_expr
  member: (identifier) @property)

; Named call arguments
(named_call_arg
  name: (identifier) @variable.named_parameter)

; Operators
(prefix_op) @operator
(postfix_op) @operator
(compound_assign_op) @operator
"=" @operator
"==" @operator
"!=" @operator
"<" @operator
"<=" @operator
">" @operator
">=" @operator
"+" @operator
"-" @operator
"*" @operator
"/" @operator
"%" @operator
"**" @operator
"//" @operator
"&&" @operator
"||" @operator
"!" @operator
"&" @operator
"|" @operator
"^" @operator
"~" @operator
"<<" @operator
">>" @operator
"??" @operator
"?" @operator
":" @operator
"->" @operator
"." @punctuation.delimiter
"..." @operator

; Punctuation
"(" @punctuation.bracket
")" @punctuation.bracket
"[" @punctuation.bracket
"]" @punctuation.bracket
"{" @punctuation.bracket
"}" @punctuation.bracket
"," @punctuation.delimiter
";" @punctuation.delimiter

; Type annotations
(var_bind
  type: (_) @type)  