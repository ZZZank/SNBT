import { ValueNode, CompoundNode, ListNode, ByteArrayNode, IntArrayNode, LongArrayNode,
	StringNode, NumberNode, BooleanNode, OperationNode, KeyValuePair } from './parser/ast';

export interface FormatOptions {
	indentSize: number;
	useTabs: boolean;
}

export function formatNode(node: ValueNode, options: FormatOptions): string {
	const indent = options.useTabs
		? '\t'
		: ' '.repeat(options.indentSize);
	return formatValue(node, indent, 0);
}

function indentStr(indent: string, depth: number): string {
	return indent.repeat(depth);
}

function formatValue(node: ValueNode, indent: string, depth: number): string {
	switch (node.kind) {
		case 'compound': return formatCompound(node, indent, depth);
		case 'list': return formatList(node, indent, depth);
		case 'byte_array': return formatByteArray(node);
		case 'int_array': return formatIntArray(node);
		case 'long_array': return formatLongArray(node);
		case 'string': return formatString(node);
		case 'number': return node.raw;
		case 'boolean': return node.value ? 'true' : 'false';
		case 'operation': return formatOperation(node, indent, depth);
	}
}

function formatCompound(node: CompoundNode, indent: string, depth: number): string {
	if (node.pairs.length === 0) return '{}';

	const inner = node.pairs
		.map(kv => indentStr(indent, depth + 1) + formatKey(kv.key) + ': ' + formatValue(kv.value, indent, depth + 1))
		.join(',\n');

	return '{\n' + inner + '\n' + indentStr(indent, depth) + '}';
}

function formatList(node: ListNode, indent: string, depth: number): string {
	if (node.elements.length === 0) return '[]';

	const inner = node.elements
		.map(e => indentStr(indent, depth + 1) + formatValue(e, indent, depth + 1))
		.join(',\n');

	return '[\n' + inner + '\n' + indentStr(indent, depth) + ']';
}

function formatByteArray(node: ByteArrayNode): string {
	if (node.elements.length === 0) return '[B;]';
	return '[B; ' + node.elements.map(e => e + 'b').join(', ') + ']';
}

function formatIntArray(node: IntArrayNode): string {
	if (node.elements.length === 0) return '[I;]';
	return '[I; ' + node.elements.join(', ') + ']';
}

function formatLongArray(node: LongArrayNode): string {
	if (node.elements.length === 0) return '[L;]';
	return '[L; ' + node.elements.map(e => e + 'l').join(', ') + ']';
}

function formatString(node: StringNode): string {
	return '"' + escapeString(node.value) + '"';
}

function formatOperation(node: OperationNode, indent: string, depth: number): string {
	const args = node.args.map(a => formatValue(a, indent, depth)).join(', ');
	return '-{}-' + node.name + '(' + args + ')';
}

function formatKey(key: string): string {
	// Safe bare string: cannot start with 0-9 . + -, only contains safe chars
	if (/^[a-zA-Z_][a-zA-Z0-9_+\-.]*$/.test(key) && !/^(?:true|false)$/i.test(key)) {
		return key;
	}
	// Need to quote
	return '"' + escapeString(key) + '"';
}

function escapeString(s: string): string {
	let out = '';
	for (const ch of s) {
		switch (ch) {
			case '"': out += '\\"'; break;
			case '\\': out += '\\\\'; break;
			case '\n': out += '\\n'; break;
			case '\t': out += '\\t'; break;
			case '\r': out += '\\r'; break;
			case '\b': out += '\\b'; break;
			case '\f': out += '\\f'; break;
			default: out += ch;
		}
	}
	return out;
}
