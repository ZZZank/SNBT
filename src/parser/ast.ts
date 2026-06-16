export enum NumberType {
	Byte,
	Short,
	Int,
	Long,
	Float,
	Double,
}

export interface Position {
	line: number;
	column: number;
}

export interface KeyValuePair {
	key: string;
	keyPos: Position;
	value: ValueNode;
}

export interface CompoundNode {
	kind: 'compound';
	pairs: KeyValuePair[];
}

export interface ListNode {
	kind: 'list';
	elements: ValueNode[];
}

export interface ByteArrayNode {
	kind: 'byte_array';
	elements: number[];
}

export interface IntArrayNode {
	kind: 'int_array';
	elements: number[];
}

export interface LongArrayNode {
	kind: 'long_array';
	elements: bigint[];
}

export interface StringNode {
	kind: 'string';
	value: string;
}

export interface NumberNode {
	kind: 'number';
	raw: string;
	type: NumberType;
}

export interface BooleanNode {
	kind: 'boolean';
	value: boolean;
}

export interface OperationNode {
	kind: 'operation';
	name: string;
	args: ValueNode[];
}

export type ValueNode =
	| CompoundNode
	| ListNode
	| ByteArrayNode
	| IntArrayNode
	| LongArrayNode
	| StringNode
	| NumberNode
	| BooleanNode
	| OperationNode;

export interface ParseError {
	message: string;
	line: number;
	column: number;
	length: number;
}

export interface ParseResult {
	ast: ValueNode | null;
	errors: ParseError[];
}
