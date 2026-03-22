/**
 * @file Tree-sitter grammar for the Feral programming implementation
 * @author Elec <feral@mail.electrux.me>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const PREC = {
    COMMA: 1,
    ASSIGN: 2,
    TERNARY: 3,
    COMPOUND_ASSIGN: 4,
    OR_BLOCK: 4,
    NIL_COALESCE: 5,
    LOGICAL_OR: 6,
    LOGICAL_AND: 7,
    BITWISE_OR: 8,
    BITWISE_XOR: 9,
    BITWISE_AND: 10,
    EQUALITY: 11,
    RELATIONAL: 12,
    SHIFT: 13,
    ADDITIVE: 14,
    MULTIPLICATIVE: 15,
    UNARY_PREFIX: 16,
    UNARY_POSTFIX: 17,
    CALL: 18,
};

module.exports = grammar({
    name: "feral",

    extras: ($) => [/\s/, $.line_comment, $.block_comment],

    word: ($) => $.identifier,

    conflicts: ($) => [
        // named_call_arg vs _primary when looking at string/atom before '='
        [$.named_call_arg, $._primary],
        // or_block: attached to compound_assign_expr vs wrapping it as or_expr
        [$.compound_assign_expr, $.or_expr],
    ],

    rules: {
        // =========================================================
        // Top-level
        // =========================================================

        source_file: ($) => repeat($._statement),

        // =========================================================
        // Comments
        // =========================================================

        line_comment: (_) => token(seq("#", /.*/)),

        // NOTE: Feral supports nested block comments (/* /* */ */), but tree-sitter's
        // regular lexer consumes '/' before the external scanner can inspect '/*'.
        // This non-recursive token handles the common case; nested comments will
        // cause a parse error at the orphaned '*/'.
        block_comment: (_) => token(seq("/*", /[^*]*(\*+[^/*][^*]*)*\*+/, "/")),

        // =========================================================
        // Statements
        // =========================================================

        _statement: ($) =>
            choice(
                $.var_decl_stmt,
                $.conditional,
                $.for_loop,
                $.for_in_loop,
                $.while_loop,
                $.return_stmt,
                $.defer_stmt,
                $.continue_stmt,
                $.break_stmt,
                $.braced_block,
                $.expr_stmt
            ),

        var_decl_stmt: ($) => seq($.var_decl, ";"),

        expr_stmt: ($) => seq($._expr, ";"),

        return_stmt: ($) => seq("return", optional($._expr_nc), ";"),

        defer_stmt: ($) => seq("defer", $._expr_nc, ";"),

        continue_stmt: (_) => seq("continue", ";"),

        break_stmt: (_) => seq("break", ";"),

        // =========================================================
        // Braced block
        // =========================================================

        braced_block: ($) => seq("{", repeat($._statement), "}"),

        // =========================================================
        // Variable declaration
        // =========================================================

        var_decl: ($) =>
            seq(
                optional(field("doc", $.string_literal)),
                "let",
                $.var_bind,
                repeat(seq(",", $.var_bind))
            ),

        var_bind: ($) =>
            seq(
                field("name", $._var_name),
                optional(seq("in", field("type", $._expr_nc))),
                "=",
                field("value", $._expr_nc)
            ),

        _var_name: ($) => choice($.identifier, $.string_literal, $.atom),

        // =========================================================
        // Function definition
        // =========================================================

        fn_def: ($) =>
            seq("fn", "(", optional($.fn_params), ")", $.braced_block),

        fn_params: ($) => seq($.fn_param, repeat(seq(",", $.fn_param))),

        fn_param: ($) =>
            choice(
                seq(field("name", $.identifier), "..."),
                field("name", $.string_literal),
                field("name", $.atom),
                seq(
                    field("name", $.identifier),
                    optional(seq("=", field("default", $._expr_nc)))
                )
            ),

        // =========================================================
        // Conditional
        // =========================================================

        conditional: ($) =>
            seq(
                optional("inline"),
                "if",
                field("condition", $._expr_nc),
                field("consequence", $.braced_block),
                repeat(
                    seq(
                        "elif",
                        field("condition", $._expr_nc),
                        field("consequence", $.braced_block)
                    )
                ),
                optional(seq("else", field("alternative", $.braced_block)))
            ),

        // =========================================================
        // Loops
        // =========================================================

        for_loop: ($) =>
            seq(
                "for",
                field("init", optional($._for_init)),
                ";",
                field("condition", optional($._expr_nc)),
                ";",
                field("update", optional($._expr)),
                $.braced_block
            ),

        // for_init can use comma (e.g. for expr, expr; ...)
        _for_init: ($) => choice($.var_decl, $._expr),

        for_in_loop: ($) =>
            seq(
                "for",
                field("variable", $.identifier),
                "in",
                field("iterable", $._expr_nc),
                $.braced_block
            ),

        while_loop: ($) =>
            seq("while", field("condition", $._expr_nc), $.braced_block),

        // =========================================================
        // Expressions
        //
        // _expr     = comma expression (top-level, for loops, etc.)
        // _expr_nc  = no-comma expression (call args, conditions, etc.)
        // =========================================================

        _expr: ($) =>
            choice(
                $.comma_expr,
                $._expr_nc
            ),

        // Comma (lowest precedence, not allowed in call_arg context)
        comma_expr: ($) =>
            prec.left(PREC.COMMA, seq($._expr_nc, ",", $._expr_nc)),

        // All non-comma expressions share _expr_nc
        _expr_nc: ($) =>
            choice(
                $.assignment_expr,
                $.ternary_expr,
                $.compound_assign_expr,
                $.or_expr,
                $.nil_coalesce_expr,
                $.logical_or_expr,
                $.logical_and_expr,
                $.bitwise_or_expr,
                $.bitwise_xor_expr,
                $.bitwise_and_expr,
                $.equality_expr,
                $.relational_expr,
                $.shift_expr,
                $.additive_expr,
                $.multiplicative_expr,
                $.unary_prefix_expr,
                $.unary_postfix_expr,
                $.call_expr,
                $.subscript_expr,
                $.member_expr,
                $.prefixed_literal,
                $.suffixed_literal,
                $.paren_expr,
                $.fn_def,
                $.await_expr,
                $.yield_expr,
                $._primary
            ),

        // Assignment (right-associative)
        assignment_expr: ($) =>
            prec.right(PREC.ASSIGN, seq($._expr_nc, "=", $._expr_nc)),

        // Ternary
        ternary_expr: ($) =>
            prec.right(PREC.TERNARY, seq($._expr_nc, "?", $._expr_nc, ":", $._expr_nc)),

        // Compound assignment + optional or-block
        compound_assign_expr: ($) =>
            prec.left(
                PREC.COMPOUND_ASSIGN,
                seq($._expr_nc, $.compound_assign_op, $._expr_nc, optional($.or_block))
            ),

        compound_assign_op: (_) =>
            choice("+=", "-=", "*=", "/=", "%=", "<<=", ">>=", "&=", "|=", "~=", "^="),

        // Or-block as an expression suffix (any expression can have an or-block)
        or_expr: ($) =>
            prec.left(PREC.OR_BLOCK, seq($._expr_nc, $.or_block)),

        or_block: ($) =>
            seq("or", optional(field("error_var", $.identifier)), $.braced_block),

        // Nil-coalesce
        nil_coalesce_expr: ($) =>
            prec.left(PREC.NIL_COALESCE, seq($._expr_nc, "??", $._expr_nc)),

        // Logical OR
        logical_or_expr: ($) =>
            prec.left(PREC.LOGICAL_OR, seq($._expr_nc, "||", $._expr_nc)),

        // Logical AND
        logical_and_expr: ($) =>
            prec.left(PREC.LOGICAL_AND, seq($._expr_nc, "&&", $._expr_nc)),

        // Bitwise OR
        bitwise_or_expr: ($) =>
            prec.left(PREC.BITWISE_OR, seq($._expr_nc, "|", $._expr_nc)),

        // Bitwise XOR
        bitwise_xor_expr: ($) =>
            prec.left(PREC.BITWISE_XOR, seq($._expr_nc, "^", $._expr_nc)),

        // Bitwise AND
        bitwise_and_expr: ($) =>
            prec.left(PREC.BITWISE_AND, seq($._expr_nc, "&", $._expr_nc)),

        // Equality
        equality_expr: ($) =>
            prec.left(PREC.EQUALITY, seq($._expr_nc, choice("==", "!="), $._expr_nc)),

        // Relational
        relational_expr: ($) =>
            prec.left(PREC.RELATIONAL, seq($._expr_nc, choice("<=", ">=", "<", ">"), $._expr_nc)),

        // Shift
        shift_expr: ($) =>
            prec.left(PREC.SHIFT, seq($._expr_nc, choice("<<", ">>"), $._expr_nc)),

        // Additive
        additive_expr: ($) =>
            prec.left(PREC.ADDITIVE, seq($._expr_nc, choice("+", "-"), $._expr_nc)),

        // Multiplicative (**  //  *  /  %)
        multiplicative_expr: ($) =>
            prec.left(PREC.MULTIPLICATIVE, seq($._expr_nc, choice("**", "//", "*", "/", "%"), $._expr_nc)),

        // Unary prefix
        unary_prefix_expr: ($) =>
            prec.right(PREC.UNARY_PREFIX, seq($.prefix_op, $._expr_nc)),

        prefix_op: (_) => choice("++", "--", "+", "-", "*", "&", "!", "~"),

        // Unary postfix
        unary_postfix_expr: ($) =>
            prec.left(PREC.UNARY_POSTFIX, seq($._expr_nc, $.postfix_op)),

        postfix_op: (_) => choice("++", "--", "..."),

        // Call
        call_expr: ($) =>
            prec.left(
                PREC.CALL,
                seq(
                    $._expr_nc,
                    "(",
                    optional(seq($.call_arg, repeat(seq(",", $.call_arg)))),
                    ")"
                )
            ),

        // call_arg: named (identifier/string/atom '=' expr) or positional (_expr_nc)
        call_arg: ($) => choice($.named_call_arg, $._expr_nc),

        named_call_arg: ($) =>
            seq(
                field("name", choice($.identifier, $.string_literal, $.atom)),
                "=",
                field("value", $._expr_nc)
            ),

        // Subscript
        subscript_expr: ($) =>
            prec.left(PREC.CALL, seq($._expr_nc, "[", $._expr_nc, "]")),

        // Member access
        member_expr: ($) =>
            prec.left(PREC.CALL, seq($._expr_nc, choice(".", "->"), field("member", $._primary))),

        // Parenthesised expression
        paren_expr: ($) => seq("(", $._expr, ")"),

        // Prefixed literal: IDENT LIT (adjacent, no whitespace — parser handles disambiguation)
        prefixed_literal: ($) =>
            prec(PREC.CALL + 1,
                seq(
                    field("prefix", $.identifier),
                    field("literal", choice($.integer_literal, $.float_literal, $.string_literal))
                )
            ),

        // Suffixed literal: LIT IDENT
        suffixed_literal: ($) =>
            prec(PREC.CALL + 1,
                seq(
                    field("literal", choice($.integer_literal, $.float_literal, $.string_literal)),
                    field("suffix", $.identifier)
                )
            ),

        // Await / wait
        await_expr: ($) =>
            prec.right(seq(choice("await", "wait"), $._expr_nc)),

        // Yield
        yield_expr: ($) =>
            prec.right(seq("yield", optional($._expr_nc))),

        // =========================================================
        // Primary
        // =========================================================

        _primary: ($) =>
            choice(
                $.identifier,
                $.string_literal,
                $.atom,
                $.integer_literal,
                $.float_literal,
                "void",
                "true",
                "false",
                "nil"
            ),

        // =========================================================
        // Literals
        // =========================================================

        integer_literal: (_) =>
            token(
                choice(
                    /0[xX][0-9a-fA-F]+/,
                    /0[bB][01]+/,
                    /0[0-7]+/,
                    /[0-9]+/
                )
            ),

        float_literal: (_) => token(/[0-9]+\.[0-9]+/),

        string_literal: (_) =>
            token(
                choice(
                    seq('"', repeat(choice(/[^"\\]/, /\\./)), '"'),
                    seq("'", repeat(choice(/[^'\\]/, /\\./)), "'"),
                    seq("`", repeat(choice(/[^`\\]/, /\\./)), "`")
                )
            ),

        atom: (_) => token(seq(".", /[a-zA-Z_][a-zA-Z0-9_]*/)),

        identifier: (_) => /[a-zA-Z_][a-zA-Z0-9_]*/,
    },
});
