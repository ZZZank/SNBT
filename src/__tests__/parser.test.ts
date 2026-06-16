import { parse } from '../parser';
import * as process from "node:process"

function assert(condition: boolean, message: string) {
	if (!condition) throw new Error(`FAIL: ${message}`);
}

function assertEqual<T>(a: T, b: T, msg: string) {
	if (a !== b) throw new Error(`FAIL: ${msg} — expected '${b}', got '${a}'`);
}

// ==============================
// Numeric types
// ==============================
function test_numbers() {
	const r = parse('{a: 1b, b: 1s, c: 42, d: 1l, e: 3.14f, f: 3.14d, g: 3.14}');
	assert(r.errors.length === 0, `number parsing errors: ${r.errors.map(e => e.message).join(', ')}`);
}

function test_number_suffixes() {
	const r = parse('{a: 123sb, b: 240ub, c: 1i, d: 0xFF, e: 0b1010, f: 0x11ub}');
	assert(r.errors.length === 0, `number suffix errors: ${r.errors.map(e => e.message).join(', ')}`);
}

function test_number_underscores() {
	const r = parse('{a: 1_000, b: 1_2.3_4__5f, c: 1_2e3_4}');
	assert(r.errors.length === 0, `number underscore errors: ${r.errors.map(e => e.message).join(', ')}`);
}

function test_scientific_notation() {
	const r = parse('{a: 1.2e3, b: 1.2E+3, c: 12000e-1, d: .1e3f, e: 1e3}');
	assert(r.errors.length === 0, `sci notation errors: ${r.errors.map(e => e.message).join(', ')}`);
}

function test_float_shortcuts() {
	const r = parse('{a: .1f, b: 1.f, c: .1, d: 1.}');
	assert(r.errors.length === 0, `float shortcut errors: ${r.errors.map(e => e.message).join(', ')}`);
}

function test_zero_number() {
	const r = parse('{a: 0, b: 0b, c: 0s, d: 0l, e: 0i, f: 0.0, g: 0.0f, h: 0.0d, i: 0x0, j: 0b0, k: 0x0ub}');
	assert(r.errors.length === 0, `zero number errors: ${r.errors.map(e => e.message).join(', ')}`);
}

function test_negative_number() {
	const r = parse('{a: -1, b: -1b, c: -1s, d: -1l, e: -1.5f, f: -1.5, g: -0xFF, h: -0b1, i: -0x1sb, j: -.5f, k: -1.2e3}');
	assert(r.errors.length === 0, `negative number errors: ${r.errors.map(e => e.message).join(', ')}`);
}

// ==============================
// Strings
// ==============================
function test_strings() {
	const r = parse('{a: "hello", b: \'world\', c: bare_string}');
	assert(r.errors.length === 0, `string errors: ${r.errors.map(e => e.message).join(', ')}`);
}

function test_string_escapes() {
	const r = parse('{a: "hello\\nworld", b: "tab\\there", c: "quote\\"here", d: "slash\\\\end"}');
	assert(r.errors.length === 0, `escape errors: ${r.errors.map(e => e.message).join(', ')}`);
}

function test_unicode_escapes() {
	const r = parse('{a: "\\x42", b: "\\u2603", c: "\\U0001F600"}');
	assert(r.errors.length === 0, `unicode escape errors: ${r.errors.map(e => e.message).join(', ')}`);
}

// ==============================
// Booleans
// ==============================
function test_booleans() {
	const r = parse('{a: true, b: false}');
	assert(r.errors.length === 0, `boolean errors: ${r.errors.map(e => e.message).join(', ')}`);
}

// ==============================
// Compounds
// ==============================
function test_empty_compound() {
	const r = parse('{}');
	assert(r.errors.length === 0, `empty compound errors: ${r.errors.map(e => e.message).join(', ')}`);
}

function test_nested_compound() {
	const r = parse('{a: {b: {c: 1}}}');
	assert(r.errors.length === 0, `nested compound errors: ${r.errors.map(e => e.message).join(', ')}`);
}

function test_trailing_comma_compound() {
	const r = parse('{a: 1, b: 2,}');
	assert(r.errors.length === 0, `trailing comma errors: ${r.errors.map(e => e.message).join(', ')}`);
}

// ==============================
// Lists
// ==============================
function test_empty_list() {
	const r = parse('[]');
	assert(r.errors.length === 0, `empty list errors: ${r.errors.map(e => e.message).join(', ')}`);
}

function test_trailing_comma_list() {
	const r = parse('[1, 2,]');
	assert(r.errors.length === 0, `trailing comma in list errors: ${r.errors.map(e => e.message).join(', ')}`);
}

function test_mixed_list() {
	const r = parse(`['', {text: "hello"}, 123]`);
	assert(r.errors.length === 0, `mixed list errors: ${r.errors.map(e => e.message).join(', ')}`);
}

// ==============================
// Arrays
// ==============================
function test_typed_arrays() {
	const r = parse('[B; 1b, 2b, 3b]');
	assert(r.errors.length === 0, `byte array errors: ${r.errors.map(e => e.message).join(', ')}`);
	const r2 = parse('[I; 1, 2, 3]');
	assert(r2.errors.length === 0, `int array errors: ${r2.errors.map(e => e.message).join(', ')}`);
	const r3 = parse('[L; 1l, 2l, 3l]');
	assert(r3.errors.length === 0, `long array errors: ${r3.errors.map(e => e.message).join(', ')}`);
}

function test_implicit_array_type() {
	const r = parse('[B; 1, 2]');
	assert(r.errors.length === 0, `implicit byte errors: ${r.errors.map(e => e.message).join(', ')}`);
	const r2 = parse('[I; 1b, 2s, 3]');
	assert(r2.errors.length === 0, `implicit int errors: ${r2.errors.map(e => e.message).join(', ')}`);
}

// ==============================
// Operations
// ==============================
function test_operations() {
	const r = parse('-{}-bool(5)');
	assert(r.errors.length === 0, `bool op errors: ${r.errors.map(e => e.message).join(', ')}`);
	const r2 = parse('-{}-uuid("f81d4fae-7dec-11d0-a765-00a0c91e6bf6")');
	assert(r2.errors.length === 0, `uuid op errors: ${r2.errors.map(e => e.message).join(', ')}`);
}

// ==============================
// Strict mode errors
// ==============================
function test_strict_missing_comma_list() {
	const r = parse('["a" "b"]');
	assert(r.errors.length > 0, 'should error on missing comma in list (strict)');
}

function test_strict_missing_comma_compound() {
	const r = parse('{a: 1\nb: 2}');
	assert(r.errors.length > 0, 'should error on newline instead of comma in compound (strict)');
}

function test_strict_missing_colon() {
	const r = parse('{a 1}');
	assert(r.errors.length > 0, 'should error on missing colon');
}

// ==============================
// Lenient mode
// ==============================
function test_lenient_newline_list() {
	const r = parse('["a"\n"b"\n"c"]', { lenient: true });
	assert(r.errors.length === 0, `lenient list errors: ${r.errors.map(e => e.message).join(', ')}`);
}

function test_lenient_newline_compound() {
	const r = parse(`{
		a: 1
		b: 2
		c: 3
	}`, { lenient: true });
	assert(r.errors.length === 0, `lenient compound errors: ${r.errors.map(e => e.message).join(', ')}`);
}

function test_lenient_mixed_separators() {
	const r = parse(`{a: 1, b: 2
	c: 3, d: 4}`, { lenient: true });
	assert(r.errors.length === 0, `lenient mixed errors: ${r.errors.map(e => e.message).join(', ')}`);
}

function test_lenient_deep_nested() {
	const r = parse(`{
		this: [
			"is"
			"a"
			"valid"
			"SNBT"
		]
	}`, { lenient: true });
	assert(r.errors.length === 0, `lenient deep nested errors: ${r.errors.map(e => e.message).join(', ')}`);
}

function test_lenient_typed_array() {
	const r = parse('[B;\n1b\n2b\n3b]', { lenient: true });
	assert(r.errors.length === 0, `lenient array errors: ${r.errors.map(e => e.message).join(', ')}`);
}

// ==============================
// Mode switching: strict fails, lenient passes
// ==============================
function test_mode_switching() {
	const src = '{a: 1\nb: 2}';
	const strict = parse(src, { lenient: false });
	const lenient = parse(src, { lenient: true });

	assert(strict.errors.length > 0, 'strict mode should fail on newline-separated compound');
	assert(lenient.errors.length === 0, `lenient mode should pass on same input, got: ${lenient.errors.map(e => e.message).join(', ')}`);
}

// ==============================
// Edge cases
// ==============================
function test_line_comment_skip() {
	const r = parse(`{
		# this is a comment
		a: 1
	}`, { lenient: true });
	assert(r.errors.length === 0, `comment handling errors: ${r.errors.map(e => e.message).join(', ')}`);
}

function test_unclosed_string() {
	const r = parse('{a: "unclosed}');
	assert(r.errors.length > 0, 'should error on unclosed string');
}

function test_stray_comma() {
	const r = parse('[,]');
	assert(r.errors.length > 0, 'should error on stray comma at start');
}

// ==============================
// Formatter
// ==============================
import { formatNode, FormatOptions } from '../formatter';

const fmtOpts: FormatOptions = { indentSize: 4, useTabs: false };

function fmt(src: string, lenient = false): string {
	const result = parse(src, { lenient });
	if (!result.ast || result.errors.length > 0) {
		throw new Error(`parse failed: ${result.errors.map(e => e.message).join(', ')}`);
	}
	return formatNode(result.ast, fmtOpts);
}

function test_format_basic() {
	const out = fmt('{a:1,b:2}');
	const expected = '{\n    a: 1,\n    b: 2\n}';
	assert(out === expected, `format basic:\n${JSON.stringify(out)}\n!==\n${JSON.stringify(expected)}`);
	// roundtrip
	const r2 = parse(out, {});
	assert(r2.errors.length === 0, `format basic roundtrip errors: ${r2.errors.map(e => e.message).join(', ')}`);
}

function test_format_nested() {
	const out = fmt('{a:{b:{c:1}}}');
	const expected = '{\n    a: {\n        b: {\n            c: 1\n        }\n    }\n}';
	assert(out === expected, `format nested:\n${out}\n!==\n${expected}`);
}

function test_format_array() {
	const out = fmt('[B;1b,2b,3b]');
	assert(out === '[B; 1b, 2b, 3b]', `format array: ${out}`);
}

function test_format_roundtrip() {
	const cases = [
		'{a: 1b, b: 1s, c: 42, d: 1l, e: 3.14f, f: 3.14d, g: true, h: "hello"}',
		'{flag: true, name: "test\\nvalue", nested: {x: 0xFF, y: [1, 2, 3]}}',
		'{arr: [I; 1, 2, 3], empty: {}, items: ["a", "b", "c"]}',
	];
	for (const src of cases) {
		const pass1 = fmt(src);
		const pass2 = fmt(pass1);
		assert(pass1 === pass2, `format roundtrip:\n${pass1}\n!==\n${pass2}`);
	}
}

function test_format_tab_indent() {
	const tabOpts: FormatOptions = { indentSize: 4, useTabs: true };
	const out = formatNode(parse('{a: 1, b: 2}', {}).ast!, tabOpts);
	const expected = '{\n\ta: 1,\n\tb: 2\n}';
	assert(out === expected, `format tabs:\n${JSON.stringify(out)}\n!==\n${JSON.stringify(expected)}`);
}

function test_format_custom_indent_size() {
	const twoOpts: FormatOptions = { indentSize: 2, useTabs: false };
	const out = formatNode(parse('{a: {b: 1}}', {}).ast!, twoOpts);
	const expected = '{\n  a: {\n    b: 1\n  }\n}';
	assert(out === expected, `format 2-space:\n${JSON.stringify(out)}\n!==\n${JSON.stringify(expected)}`);
}

// ==============================
// Run
// ==============================
const tests = [
	test_numbers,
	test_number_suffixes,
	test_number_underscores,
	test_zero_number,
	test_negative_number,
	test_scientific_notation,
	test_float_shortcuts,
	test_strings,
	test_string_escapes,
	test_unicode_escapes,
	test_booleans,
	test_empty_compound,
	test_nested_compound,
	test_trailing_comma_compound,
	test_empty_list,
	test_trailing_comma_list,
	test_mixed_list,
	test_typed_arrays,
	test_implicit_array_type,
	test_operations,
	test_strict_missing_comma_list,
	test_strict_missing_comma_compound,
	test_strict_missing_colon,
	test_lenient_newline_list,
	test_lenient_newline_compound,
	test_lenient_mixed_separators,
	test_lenient_deep_nested,
	test_lenient_typed_array,
	test_mode_switching,
	test_line_comment_skip,
	test_unclosed_string,
	test_stray_comma,
	test_format_basic,
	test_format_nested,
	test_format_array,
	test_format_roundtrip,
	test_format_tab_indent,
	test_format_custom_indent_size,
];

let passed = 0;
let failed = 0;

for (const test of tests) {
	try {
		test();
		passed++;
	} catch (e: any) {
		console.error(`  ✗ ${test.name}: ${e.message}`);
		failed++;
	}
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
