import { Token, TokenType } from './token';
import {
	ValueNode, CompoundNode, ListNode, ByteArrayNode, IntArrayNode, LongArrayNode,
	StringNode, NumberNode, BooleanNode, OperationNode, KeyValuePair,
	ParseResult, ParseError, NumberType, Position,
} from './ast';
import { Lexer } from './lexer';
import { makeError } from './errors';

export interface ParserOptions {
	lenient?: boolean;
}

enum ArrayKind { Byte, Int, Long }

export function parse(source: string, options?: ParserOptions): ParseResult {
	const lexer = new Lexer(source);
	const tokens = lexer.tokenize();
	const parser = new Parser(tokens, options);
	return parser.parse();
}

class Parser {
	private tokens: Token[];
	private pos = 0;
	private options: Required<ParserOptions>;
	private errors: ParseError[] = [];

	constructor(tokens: Token[], options?: ParserOptions) {
		this.tokens = tokens;
		this.options = { lenient: options?.lenient ?? false };
	}

	parse(): ParseResult {
		const ast = this.parseValue();
		return { ast, errors: this.errors };
	}

	// ============ Value dispatch ============

	private parseValue(): ValueNode | null {
		const tok = this.peek();
		switch (tok.type) {
			case TokenType.LBRACE:
				return this.parseCompound();
			case TokenType.LBRACKET:
				return this.parseBracketContainer();
			case TokenType.OPERATION_PREFIX:
				return this.parseOperation();
			case TokenType.STRING_DOUBLE:
			case TokenType.STRING_SINGLE:
				return this.parseStringLiteral();
			case TokenType.BARE_STRING:
				return this.parseStringLiteral();
			case TokenType.NUMBER:
				return this.parseNumber();
			case TokenType.BOOLEAN:
				return this.parseBoolean();
			default:
				this.error(this.pos, `unexpected token: '${tok.lexeme}'`);
				this.advance();
				return null;
		}
	}

	// ============ Compound: { key: value, ... } ============

	private parseCompound(): CompoundNode {
		this.expect(TokenType.LBRACE);
		const pairs: KeyValuePair[] = [];
		let first = true;

		while (!this.check(TokenType.RBRACE) && !this.check(TokenType.EOF)) {
			// Handle comma: trailing, leading, or separator
			if (this.check(TokenType.COMMA)) {
				this.advance();
				if (this.check(TokenType.RBRACE)) {
					if (first) this.error(this.pos - 1, 'unexpected comma');
					break;
				}
				if (first) this.error(this.pos - 1, 'unexpected comma');
				// comma serves as separator between pairs
			} else if (!first) {
				const sep = this.expectElementSeparator();
				if (sep === 'end') break;
			}
			first = false;

			if (this.check(TokenType.RBRACE) || this.check(TokenType.EOF)) break;

			// Key
			const keyToken = this.peek();
			if (keyToken.type !== TokenType.STRING_DOUBLE &&
				keyToken.type !== TokenType.STRING_SINGLE &&
				keyToken.type !== TokenType.BARE_STRING) {
				this.error(this.pos, `expected key, got '${keyToken.lexeme}'`);
				this.advance();
				continue;
			}
			this.advance();
			const key = keyToken.lexeme;
			const keyPos: Position = { line: keyToken.line, column: keyToken.column };

			// Colon
			if (!this.check(TokenType.COLON)) {
				this.error(this.pos, `expected ':', got '${this.peek().lexeme}'`);
			} else {
				this.advance();
			}

			// Value
			const value = this.parseValue();
			if (value) {
				pairs.push({ key, keyPos, value });
			}
		}

		this.expect(TokenType.RBRACE);
		return { kind: 'compound', pairs };
	}

	// ============ List / Array: [...] ============

	private parseBracketContainer(): ValueNode {
		if (this.checkArrayPrefix()) {
			return this.parseArray();
		}
		return this.parseList();
	}

	private checkArrayPrefix(): boolean {
		if (this.peek().type !== TokenType.LBRACKET) return false;
		const next = this.tokenAt(this.pos + 1);
		if (!next || next.type !== TokenType.BARE_STRING) return false;
		if (!/^[BIL]$/i.test(next.lexeme)) return false;
		const semi = this.tokenAt(this.pos + 2);
		return !!semi && semi.type === TokenType.SEMICOLON;
	}

	private parseList(): ListNode {
		this.expect(TokenType.LBRACKET);
		const elements: ValueNode[] = [];
		let first = true;

		while (!this.check(TokenType.RBRACKET) && !this.check(TokenType.EOF)) {
			if (this.check(TokenType.COMMA)) {
				this.advance();
				if (this.check(TokenType.RBRACKET)) {
					if (first) this.error(this.pos - 1, 'unexpected comma');
					break;
				}
				if (first) this.error(this.pos - 1, 'unexpected comma');
			} else if (!first) {
				const sep = this.expectElementSeparator();
				if (sep === 'end') break;
			}
			first = false;

			if (this.check(TokenType.RBRACKET) || this.check(TokenType.EOF)) break;

			const val = this.parseValue();
			if (val) elements.push(val);
		}

		this.expect(TokenType.RBRACKET);
		return { kind: 'list', elements };
	}

	private parseArray(): ByteArrayNode | IntArrayNode | LongArrayNode {
		this.expect(TokenType.LBRACKET);
		const typeTok = this.advance(); // B/I/L
		const kind: ArrayKind =
			/^b$/i.test(typeTok.lexeme) ? ArrayKind.Byte :
			/^i$/i.test(typeTok.lexeme) ? ArrayKind.Int :
			ArrayKind.Long;
		this.expect(TokenType.SEMICOLON);

		const elements: number[] = [];
		const longElements: bigint[] = [];
		let first = true;

		while (!this.check(TokenType.RBRACKET) && !this.check(TokenType.EOF)) {
			if (this.check(TokenType.COMMA)) {
				this.advance();
				if (this.check(TokenType.RBRACKET)) {
					if (first) this.error(this.pos - 1, 'unexpected comma');
					break;
				}
				if (first) this.error(this.pos - 1, 'unexpected comma');
			} else if (!first) {
				const sep = this.expectElementSeparator();
				if (sep === 'end') break;
			}
			first = false;

			if (this.check(TokenType.RBRACKET) || this.check(TokenType.EOF)) break;

			const val = this.parseArrayElement(kind);
			if (val !== null) {
				if (kind === ArrayKind.Long) {
					longElements.push(val);
				} else {
					elements.push(Number(val));
				}
			}
		}

		this.expect(TokenType.RBRACKET);

		if (kind === ArrayKind.Byte) return { kind: 'byte_array', elements };
		if (kind === ArrayKind.Int) return { kind: 'int_array', elements };
		return { kind: 'long_array', elements: longElements };
	}

	private parseArrayElement(kind: ArrayKind): bigint | null {
		const tok = this.peek();
		if (tok.type !== TokenType.NUMBER) {
			this.error(this.pos, `expected number, got '${tok.lexeme}'`);
			this.advance();
			return null;
		}

		const raw = tok.lexeme;
		this.advance();

		// Heuristic: match value based on numeric literal characteristics
		const value = BigInt(raw.replace(/[usbBsSiIlLfFdDUu]+$/g, ''));
		switch (kind) {
			case ArrayKind.Byte: return BigInt(Number(value) & 0xFF);
			case ArrayKind.Int: return BigInt(Number(value) | 0);
			case ArrayKind.Long: return value;
		}
	}

	// ============ Operation: -{}-name(args) ============

	private parseOperation(): OperationNode {
		this.expect(TokenType.OPERATION_PREFIX);
		const nameTok = this.peek();
		if (nameTok.type !== TokenType.BARE_STRING) {
			this.error(this.pos, `expected operation name, got '${nameTok.lexeme}'`);
			this.advance();
			return { kind: 'operation', name: '', args: [] };
		}
		const name = nameTok.lexeme;
		this.advance();

		this.expect(TokenType.LPAREN);
		const args: ValueNode[] = [];
		while (!this.check(TokenType.RPAREN) && !this.check(TokenType.EOF)) {
			const val = this.parseValue();
			if (val) args.push(val);
			if (this.check(TokenType.COMMA)) this.advance();
		}
		this.expect(TokenType.RPAREN);

		return { kind: 'operation', name, args };
	}

	// ============ Literals ============

	private parseStringLiteral(): StringNode {
		const tok = this.advance();
		return { kind: 'string', value: tok.lexeme };
	}

	private parseNumber(): NumberNode {
		const tok = this.advance();
		const type = this.inferNumberType(tok.lexeme);
		return { kind: 'number', raw: tok.lexeme, type };
	}

	private parseBoolean(): BooleanNode {
		const tok = this.advance();
		return { kind: 'boolean', value: tok.lexeme === 'true' };
	}

	// ============ Lenient separator logic ============

	/**
	 * Returns 'comma' if a comma was consumed,
	 * 'end' if we hit a closing bracket/brace (element list ends),
	 * 'ok' if lenient mode accepts newline-as-separator,
	 * or records an error and returns 'ok' to continue.
	 */
	private expectElementSeparator(): 'comma' | 'end' | 'ok' {
		if (this.check(TokenType.COMMA)) {
			this.advance();
			return 'comma';
		}

		const next = this.peek();
		if (next.type === TokenType.RBRACE || next.type === TokenType.RBRACKET) {
			return 'end';
		}

		if (this.options.lenient) {
			// Find previous consumed token
			const prev = this.tokenAt(this.pos - 1);
			if (prev && next.line > prev.line) {
				return 'ok'; // newline acts as separator
			}
		}

		this.error(this.pos, `expected ',' or '}' or ']', got '${next.lexeme}'`);
		return 'ok';
	}

	// ============ Helpers ============

	private peek(): Token {
		return this.tokens[this.pos] || this.tokens[this.tokens.length - 1];
	}

	private tokenAt(index: number): Token | undefined {
		return this.tokens[index];
	}

	private check(type: TokenType): boolean {
		return this.peek().type === type;
	}

	private advance(): Token {
		return this.tokens[this.pos++] || this.tokens[this.tokens.length - 1];
	}

	private expect(type: TokenType): Token {
		if (this.check(type)) {
			return this.advance();
		}
		const tok = this.peek();
		this.error(this.pos, `expected '${TokenType[type]}', got '${tok.lexeme}'`);
		return tok;
	}

	private error(index: number, message: string): void {
		const tok = this.tokens[index] || this.tokens[this.tokens.length - 1];
		this.errors.push(makeError(message, tok.line, tok.column, tok.lexeme.length || 1));
	}

	// -------- Number type inference --------
	private inferNumberType(raw: string): NumberType {
		const last = raw[raw.length - 1]?.toLowerCase();
		if (last === 'f') return NumberType.Float;
		if (last === 'd') return NumberType.Double;
		if (last === 'b') return NumberType.Byte;
		if (last === 's') return NumberType.Short;
		if (last === 'l') return NumberType.Long;
		if (last === 'i') return NumberType.Int;

		// Check for signed/unsigned suffixes (sb, ub, ss, us, si, ui, sl, ul)
		const penult = raw[raw.length - 2]?.toLowerCase();
		if (penult === 'u' || penult === 's') {
			const typeChar = last;
			if (typeChar === 'b') return NumberType.Byte;
			if (typeChar === 's') return NumberType.Short;
			if (typeChar === 'i') return NumberType.Int;
			if (typeChar === 'l') return NumberType.Long;
		}

		// Has decimal point or scientific notation → double
		if (/[.eE]/.test(raw)) return NumberType.Double;

		// Default int
		return NumberType.Int;
	}
}
