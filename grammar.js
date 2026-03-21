/**
 * @file Tree sitter parser for Feral
 * @author Elec
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

/**
 * Tree-sitter grammar for the Feral programming language.
 * https://github.com/Feral-Lang/Feral
 *
 * Derived from Grammar.ebnf (itself derived from src/Lexer.cpp and
 * src/Parser/Parser.cpp).
 *
 * KNOWN LIMITATIONS
 * -----------------
 * 1. Atom disambiguation: Feral's lexer only recognises '.name' as an atom
 *    when the preceding character is not [a-zA-Z0-9_)]\'"]. Correct
 *    disambiguation from the member-access '.' operator requires an external
 *    (C) scanner. This grammar relies on Tree-sitter's context-aware lexer
 *    (atoms are only valid as expression primaries, not as member selectors).
 *
 * 2. Nestable block comments: '/* … *\/' comments may be nested in Feral.
 *    The regex used here does NOT handle nesting; a proper implementation
 *    requires an external scanner.
 *
 * 3. Adjacent-token constraint on prefixed/suffixed literals: Feral requires
 *    no whitespace between the identifier and the literal (e.g. '9h'). This
 *    grammar accepts whitespace between them.
 */

// ── Operator precedence numbers ──────────────────────────────────────────────
// Higher number = tighter binding.
// Order matches the parse-chain in the Feral parser (see Grammar.ebnf).
const PREC = {
    COMMA: 1,
    ASSIGN: 2,   // right-associative
    TERNARY: 3,
    COMPOUND_ASSIGN: 4,   // also used for or-block (same binding level)
    NIL_COALESCE: 5,
    LOGICAL_OR: 6,
    LOGICAL_AND: 7,
    BIT_OR: 8,
    BIT_XOR: 9,
    BIT_AND: 10,
    EQUALITY: 11,
    RELATIONAL: 12,
    SHIFT: 13,
    ADDITIVE: 14,
    MULTIPLICATIVE: 15,
    PREFIX: 16,  // unary prefix: ++ -- + - * & ! ~
    POSTFIX: 17,  // unary postfix: ++ -- ...
    CALL: 18,  // call () subscript [] member . ->
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** One or more of `rule` separated by commas. */
// @ts-ignore
function commaSep1(rule) {
    return seq(rule, repeat(seq(',', rule)));
}

// ── Grammar ───────────────────────────────────────────────────────────────────

module.exports = grammar({
    name: 'feral',

    // Whitespace and comments are ignored between every token.
    extras: $ => [/\s/, $.line_comment, $.block_comment],

    // 'identifier' is the "word" token; keywords are automatically excluded.
    word: $ => $.identifier,

    rules: {

        // ── Top level ─────────────────────────────────────────────────────────────

        program: $ => repeat($.statement),

        // ── Statements ────────────────────────────────────────────────────────────

        statement: $ => choice(
            $.var_decl_statement,
            $.if_statement,
            $.for_statement,
            $.for_in_statement,
            $.while_statement,
            $.continue_statement,
            $.break_statement,
            $.defer_statement,
            $.return_statement,
            $.block,
            $.expression_statement,
        ),

        expression_statement: $ => seq($.expression, ';'),

        // ── Variable declaration ──────────────────────────────────────────────────

        // var_decl_statement = var_decl ';'
        // var_decl is shared with the for-loop init (no trailing ';' there).
        var_decl_statement: $ => seq($._var_decl, ';'),

        // _var_decl is inline (no CST node); used both as a statement and inside for.
        _var_decl: $ => seq(
            optional(field('doc', $.string_literal)),
            'let',
            commaSep1($.var_bind),
        ),

        var_bind: $ => seq(
            field('name', $._var_name),
            optional(seq('in', field('type', $.expression))),
            '=',
            field('value', $.expression),
        ),

        // A variable name can be an identifier, quoted string, or atom.
        // String/atom names create keyed bindings for member-function attachment.
        _var_name: $ => choice($.identifier, $.string_literal, $.atom),

        // ── Control flow ──────────────────────────────────────────────────────────

        return_statement: $ => seq('return', optional($.expression), ';'),

        defer_statement: $ => seq('defer', $.expression, ';'),

        continue_statement: _ => seq('continue', ';'),

        break_statement: _ => seq('break', ';'),

        if_statement: $ => seq(
            optional('inline'),
            'if',
            field('condition', $.expression),
            field('consequence', $.block),
            repeat(seq(
                'elif',
                field('condition', $.expression),
                field('consequence', $.block),
            )),
            optional(seq('else', field('alternative', $.block))),
        ),

        // C-style for loop.  All three clauses are optional.
        for_statement: $ => seq(
            'for',
            optional(field('init', $._for_init)), ';',
            optional(field('condition', $.expression)), ';',
            optional(field('increment', $.expression)),
            field('body', $.block),
        ),

        // The init clause is either a let-declaration (no trailing ';') or an
        // expression (including comma expressions).
        _for_init: $ => choice($._var_decl, $.expression),

        // for-in loop is desugared to a C-style for loop by the parser.
        for_in_statement: $ => seq(
            'for',
            field('iterator', $.identifier),
            'in',
            field('iterable', $.expression),
            field('body', $.block),
        ),

        while_statement: $ => seq(
            'while',
            field('condition', $.expression),
            field('body', $.block),
        ),

        block: $ => seq('{', repeat($.statement), '}'),

        // ── Function definition ───────────────────────────────────────────────────
        // Valid both as a statement (via expression_statement) and as an expression.

        fn_def: $ => seq(
            'fn',
            '(',
            field('params', optional($.fn_params)),
            ')',
            field('body', $.block),
        ),

        fn_params: $ => commaSep1($.fn_param),

        // Parameter forms (in order of specificity):
        //   ident '...'         variadic pack — must be last
        //   string / atom       keyword-args bundle — at most one
        //   ident ['=' expr]    regular parameter with optional default
        // 'self' is silently prepended by the parser; users do not write it.
        fn_param: $ => choice(
            seq(field('name', $.identifier), '...'),
            field('keyword_args', $.string_literal),
            field('keyword_args', $.atom),
            seq(
                field('name', $.identifier),
                optional(seq('=', field('default', $.expression))),
            ),
        ),

        // ── Expressions ───────────────────────────────────────────────────────────
        // All expression forms are alternatives of a single 'expression' rule.
        // Precedence is enforced via prec.left / prec.right / prec wrappers.

        expression: $ => choice(
            // ── Primaries ──
            $.identifier,
            $.atom,
            $.integer_literal,
            $.float_literal,
            $.string_literal,
            $.true,
            $.false,
            $.nil,
            $.parenthesized_expression,
            $.fn_def,
            $.prefixed_suffixed_literal,

            // ── Special expressions ──
            $.await_expression,
            $.yield_expression,

            // ── Postfix / call chain (tightest binding) ──
            $.call_expression,
            $.subscript_expression,
            $.member_expression,
            $.postfix_expression,

            // ── Unary prefix ──
            $.prefix_expression,

            // ── Binary ──
            $.binary_expression,
            $.nil_coalesce_expression,
            $.or_expression,
            $.compound_assignment_expression,
            $.ternary_expression,
            $.assignment_expression,
            $.comma_expression,
        ),

        // Keyword literal nodes.
        true: _ => 'true',
        false: _ => 'false',
        nil: _ => 'nil',
        void: _ => 'void',

        parenthesized_expression: $ => seq('(', $.expression, ')'),

        // ── Suffix chain (PREC.CALL — tightest) ──────────────────────────────────

        call_expression: $ => prec.left(PREC.CALL, seq(
            field('function', $.expression),
            '(',
            optional(commaSep1($.call_arg)),
            ')',
        )),

        subscript_expression: $ => prec.left(PREC.CALL, seq(
            field('object', $.expression),
            '[',
            field('index', $.expression),
            ']',
        )),

        // Both '.' and '->' produce the same DOT node in Feral; '->' is an alias.
        member_expression: $ => prec.left(PREC.CALL, seq(
            field('object', $.expression),
            field('operator', choice('.', '->')),
            field('member', $._primary),
        )),

        // ── Unary postfix (PREC.POSTFIX) ─────────────────────────────────────────

        postfix_expression: $ => prec.left(PREC.POSTFIX, seq(
            field('operand', $.expression),
            field('operator', choice('++', '--', '...')),
        )),

        // ── Unary prefix (PREC.PREFIX) ────────────────────────────────────────────

        prefix_expression: $ => prec.right(PREC.PREFIX, seq(
            field('operator', choice('++', '--', '+', '-', '*', '&', '!', '~')),
            field('operand', $.expression),
        )),

        // ── Binary operators ──────────────────────────────────────────────────────
        // Grouped into a single rule for a cleaner CST node type.

        binary_expression: $ => choice(
            prec.left(PREC.MULTIPLICATIVE, seq(
                field('left', $.expression),
                field('operator', choice('*', '/', '%', '**', '//')),
                field('right', $.expression))),

            prec.left(PREC.ADDITIVE, seq(
                field('left', $.expression),
                field('operator', choice('+', '-')),
                field('right', $.expression))),

            prec.left(PREC.SHIFT, seq(
                field('left', $.expression),
                field('operator', choice('<<', '>>')),
                field('right', $.expression))),

            prec.left(PREC.RELATIONAL, seq(
                field('left', $.expression),
                field('operator', choice('<', '<=', '>', '>=')),
                field('right', $.expression))),

            prec.left(PREC.EQUALITY, seq(
                field('left', $.expression),
                field('operator', choice('==', '!=')),
                field('right', $.expression))),

            prec.left(PREC.BIT_AND, seq(
                field('left', $.expression),
                field('operator', '&'),
                field('right', $.expression))),

            prec.left(PREC.BIT_XOR, seq(
                field('left', $.expression),
                field('operator', '^'),
                field('right', $.expression))),

            prec.left(PREC.BIT_OR, seq(
                field('left', $.expression),
                field('operator', '|'),
                field('right', $.expression))),

            prec.left(PREC.LOGICAL_AND, seq(
                field('left', $.expression),
                field('operator', '&&'),
                field('right', $.expression))),

            prec.left(PREC.LOGICAL_OR, seq(
                field('left', $.expression),
                field('operator', '||'),
                field('right', $.expression))),
        ),

        // ── nil-coalesce (PREC.NIL_COALESCE) ─────────────────────────────────────

        nil_coalesce_expression: $ => prec.left(PREC.NIL_COALESCE, seq(
            field('left', $.expression),
            '??',
            field('right', $.expression),
        )),

        // ── or-block (PREC.COMPOUND_ASSIGN — same level) ─────────────────────────
        // expr or [errVar] { handler }
        // Desugared to an anonymous error-handling callback passed to the expression.
        // If errVar is omitted the parser uses '_' as the default name.

        or_expression: $ => prec.left(PREC.COMPOUND_ASSIGN, seq(
            field('expr', $.expression),
            'or',
            optional(field('error_var', $.identifier)),
            field('handler', $.block),
        )),

        // ── Compound assignment (PREC.COMPOUND_ASSIGN) ────────────────────────────

        compound_assignment_expression: $ => prec.left(PREC.COMPOUND_ASSIGN, seq(
            field('left', $.expression),
            field('operator', choice(
                '+=', '-=', '*=', '/=', '%=',
                '<<=', '>>=',
                '&=', '|=', '~=', '^=',
            )),
            field('right', $.expression),
        )),

        // ── Ternary (PREC.TERNARY) ────────────────────────────────────────────────
        // Non-repeating: only one ternary allowed per expression at this level.

        ternary_expression: $ => prec.right(PREC.TERNARY, seq(
            field('condition', $.expression),
            '?',
            field('consequence', $.expression),
            ':',
            field('alternative', $.expression),
        )),

        // ── Assignment (PREC.ASSIGN — right-associative) ──────────────────────────

        assignment_expression: $ => prec.right(PREC.ASSIGN, seq(
            field('left', $.expression),
            '=',
            field('right', $.expression),
        )),

        // ── Comma (PREC.COMMA — loosest) ─────────────────────────────────────────

        comma_expression: $ => prec.left(PREC.COMMA, seq(
            field('left', $.assignment_expression),
            ',',
            field('right', $.assignment_expression),
        )),

        // ── Await / wait ──────────────────────────────────────────────────────────
        // Desugared by the parser to an async() call + polling loop + .result().
        // The operand must resolve to a function call; enforced semantically, not
        // syntactically.

        await_expression: $ => seq(
            field('keyword', choice('await', 'wait')),
            field('call', $.expression),
        ),

        // ── Yield ─────────────────────────────────────────────────────────────────
        // Valid both as a statement-level expression  (yield value;)
        // and inline inside a larger expression.

        yield_expression: $ => prec.right(seq('yield', optional(field('value', $.expression)))),

        // ── Prefixed / suffixed literal ───────────────────────────────────────────
        // Desugared to a function call:  9h → h(9),  ref"x" → ref("x")
        // No suffix chain (. [] ()) is available directly on this form.

        prefixed_suffixed_literal: $ => choice(
            seq(
                field('function', $.identifier),
                field('literal', choice($.integer_literal, $.float_literal, $.string_literal)),
            ),
            seq(
                field('literal', choice($.integer_literal, $.float_literal, $.string_literal)),
                field('function', $.identifier),
            ),
        ),

        // ── Call argument ─────────────────────────────────────────────────────────
        // Named form has higher priority to avoid collision with assignment_expression.

        call_arg: $ => choice(
            prec(1, seq(
                field('name', choice($.identifier, $.string_literal, $.atom)),
                '=',
                field('value', $.expression),
            )),
            field('value', $.expression),
        ),

        // ── Inline primary (used only for member_expression RHS) ─────────────────

        _primary: $ => choice(
            $.identifier,
            $.string_literal,
            $.atom,
            $.integer_literal,
            $.float_literal,
            $.true,
            $.false,
            $.nil,
        ),

        // ── Lexical tokens ────────────────────────────────────────────────────────

        identifier: _ => /[a-zA-Z_][a-zA-Z0-9_]*/,

        // Atom: dot-prefixed identifier, e.g.  .name  .ok
        // The leading '.' is part of the token but NOT stored in the atom's value
        // in Feral's runtime.  See known limitation (1) above.
        atom: _ => /\.[a-zA-Z_][a-zA-Z0-9_]*/,

        // Integer literals: decimal, hex, octal, binary.
        // Longer patterns (hex/binary) are listed first so Tree-sitter's lexer
        // prefers them over the plain decimal pattern when a leading '0' is present.
        integer_literal: _ => token(choice(
            /0[xX][0-9a-fA-F]+/,
            /0[bB][01]+/,
            /0[0-7]+/,
            /[0-9]+/,
        )),

        // Float literal: base-10 only; no scientific notation.
        float_literal: _ => /[0-9]+\.[0-9]+/,

        // String literals: double-quote, single-quote, or backtick delimited.
        // A single leading and trailing newline are stripped by the runtime.
        string_literal: $ => choice(
            seq('"', repeat(choice($.escape_sequence, /[^"\\]+/)), '"'),
            seq("'", repeat(choice($.escape_sequence, /[^'\\]+/)), "'"),
            seq('`', repeat(choice($.escape_sequence, /[^`\\]+/)), '`'),
        ),

        escape_sequence: _ => token(seq('\\', /.|\n/)),

        // Single-line comment: from '#' to end of line.
        line_comment: _ => /#[^\n]*/,

        // Block comment: '/* … */'.  See known limitation (2) above.
        block_comment: _ => /\/\*[^*]*\*+([^/*][^*]*\*+)*\//,
    },
});
