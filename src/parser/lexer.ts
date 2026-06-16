import { Token, TokenType } from './token';

export class Lexer {
	private source: string;
	private pos = 0;
	private line = 1;
	private col = 1;
	private tokens: Token[] = [];

	constructor(source: string) {
		this.source = source;
	}

	tokenize(): Token[] {
		while (this.pos < this.source.length) {
			const ch = this.peek();

			// Whitespace: skip, but track newlines for lenient mode
			if (ch === ' ' || ch === '\t' || ch === '\r') {
				this.advance();
				continue;
			}
			if (ch === '\n') {
				this.advanceLine();
				continue;
			}

			// Line comment (#)
			if (ch === '#') {
				this.skipLineComment();
				continue;
			}

			// Operation prefix -{}-
			if (ch === '-') {
				const next = this.source[this.pos + 1];
				if (next === '{') {
					const opToken = this.tryScanOperationPrefix();
					if (opToken) {
						this.tokens.push(opToken);
						continue;
					}
				}
			}

			// Strings
			if (ch === '"') {
				this.tokens.push(this.scanString('"', TokenType.STRING_DOUBLE));
				continue;
			}
			if (ch === '\'') {
				this.tokens.push(this.scanString('\'', TokenType.STRING_SINGLE));
				continue;
			}

			// Single-char punctuation
			const punct = this.scanPunctuation();
			if (punct) {
				this.tokens.push(punct);
				continue;
			}

			// Numbers
			if (this.isDigit(ch)) {
				const num = this.tryScanNumber();
				if (num) {
					this.tokens.push(num);
					continue;
				}
			}

			// Signed numbers: -1, +1, -.5, -0xFF etc.
			if (ch === '-' || ch === '+') {
				const savePos = this.pos;
				const saveCol = this.col;
				this.advance(); // consume sign
				if (this.isDigit(this.peek()) || this.peek() === '.' || this.peek() === '0') {
					const num = this.tryScanNumber();
					if (num) {
						num.lexeme = ch + num.lexeme;
						num.column = saveCol;
						this.tokens.push(num);
						continue;
					}
				}
				// Not a signed number, restore
				this.pos = savePos;
				this.col = saveCol;
				// fall through to error (bare string can't start with +/-)
			}

			// Dot-starting numbers
			if (ch === '.') {
				const num = this.tryScanFloatStartingWithDot();
				if (num) {
					this.tokens.push(num);
					continue;
				}
			}

			// Booleans and bare strings
			if (this.isIdentStart(ch)) {
				this.tokens.push(this.scanBareStringOrBoolean());
				continue;
			}

			// Unexpected character
			const c = this.advance();
			this.tokens.push(this.makeToken(TokenType.EOF as any, c));
		}

		this.tokens.push(this.makeToken(TokenType.EOF, ''));
		return this.tokens;
	}

	private makeToken(type: TokenType, lexeme: string): Token {
		return { type, lexeme, line: this.line, column: this.col - lexeme.length };
	}

	private peek(offset = 0): string {
		return this.source[this.pos + offset] || '\0';
	}

	private advance(): string {
		const ch = this.source[this.pos] || '\0';
		this.pos++;
		this.col++;
		return ch;
	}

	private advanceLine(): void {
		this.pos++;
		this.line++;
		this.col = 1;
	}

	private skipLineComment(): void {
		while (this.pos < this.source.length && this.source[this.pos] !== '\n') {
			this.pos++;
		}
		// don't consume the \n; it'll be handled on next iteration
	}

	// -------- Operation prefix: -{}- --------
	private tryScanOperationPrefix(): Token | null {
		const start = this.pos;
		const saveLine = this.line;
		const saveCol = this.col;

		if (this.source.startsWith('-{}-', this.pos)) {
			this.pos += 4;
			this.col += 4;
			return { type: TokenType.OPERATION_PREFIX, lexeme: '-{}-', line: saveLine, column: saveCol };
		}
		// not an operation prefix, restore state
		this.pos = start;
		this.line = saveLine;
		this.col = saveCol;
		return null;
	}

	// -------- Strings --------
	private scanString(quote: string, type: TokenType.STRING_DOUBLE | TokenType.STRING_SINGLE): Token {
		const startLine = this.line;
		const startCol = this.col;
		this.advance(); // consume opening quote
		const buf: string[] = [];

		while (this.pos < this.source.length) {
			const ch = this.advance();
			if (ch === quote) {
				return { type, lexeme: buf.join(''), line: startLine, column: startCol };
			}
			if (ch === '\\') {
				const escaped = this.advance();
				switch (escaped) {
					case 'b': buf.push('\b'); break;
					case 'f': buf.push('\f'); break;
					case 'n': buf.push('\n'); break;
					case 'r': buf.push('\r'); break;
					case 's': buf.push(' '); break;
					case 't': buf.push('\t'); break;
					case '\\': buf.push('\\'); break;
					case '\'': buf.push('\''); break;
					case '"': buf.push('"'); break;
					case 'x': {
						const hh = this.source.slice(this.pos, this.pos + 2);
						if (/^[0-9a-fA-F]{2}$/.test(hh)) {
							buf.push(String.fromCharCode(parseInt(hh, 16)));
							this.pos += 2; this.col += 2;
						} else {
							buf.push('\\', 'x');
						}
						break;
					}
					case 'u': {
						const hhhh = this.source.slice(this.pos, this.pos + 4);
						if (/^[0-9a-fA-F]{4}$/.test(hhhh)) {
							buf.push(String.fromCharCode(parseInt(hhhh, 16)));
							this.pos += 4; this.col += 4;
						} else {
							buf.push('\\', 'u');
						}
						break;
					}
					case 'U': {
						const hhhhhhhh = this.source.slice(this.pos, this.pos + 8);
						if (/^[0-9a-fA-F]{8}$/.test(hhhhhhhh)) {
							const cp = parseInt(hhhhhhhh, 16);
							buf.push(String.fromCodePoint(cp));
							this.pos += 8; this.col += 8;
						} else {
							buf.push('\\', 'U');
						}
						break;
					}
					case 'N': {
						if (this.peek() === '{') {
							const close = this.source.indexOf('}', this.pos + 1);
							if (close !== -1) {
								const name = this.source.slice(this.pos + 1, close);
								if (/^[a-zA-Z0-9 -]+$/.test(name)) {
									try {
										const cp = charCodePointOf(name);
										buf.push(String.fromCodePoint(cp));
									} catch {
										buf.push('\\', 'N', '{', name, '}');
									}
									this.pos = close + 1;
									this.col = this.pos - (this.source.lastIndexOf('\n', this.pos - 1) + 1) + 1;
								} else {
									buf.push('\\', 'N')
								}
							} else {
								buf.push('\\', 'N')
							}
						} else {
							buf.push('\\', 'N')
						}
						break;
					}
					default:
						buf.push('\\', escaped);
				}
			} else if (ch === '\n') {
				this.line++;
				this.col = 1;
				buf.push(ch);
			} else {
				buf.push(ch);
			}
		}

		// Unterminated string
		return { type, lexeme: buf.join(''), line: startLine, column: startCol };
	}

	// -------- Numbers --------
	private tryScanNumber(): Token | null {
		const start = this.pos;
		const startLine = this.line;
		const startCol = this.col;

		// Hex: 0x...
		if (this.peek() === '0' && (this.peek(1) === 'x' || this.peek(1) === 'X')) {
			return this.scanHexNumber();
		}

		// Binary: 0b...
		if (this.peek() === '0' && (this.peek(1) === 'b' || this.peek(1) === 'B')) {
			return this.scanBinaryNumber();
		}

		// Try scanning as float or decimal integer
		const num = this.scanDecimalOrFloat(start, startLine, startCol);
		return num;
	}

	private scanHexNumber(): Token {
		const startLine = this.line;
		const startCol = this.col;
		let lexeme = '0x';
		this.pos += 2; this.col += 2;

		while (this.pos < this.source.length && /^[0-9a-fA-F_]$/.test(this.peek())) {
			const c = this.advance();
			if (c !== '_') lexeme += c;
		}

		// Optional signed/unsigned prefix + type suffix
		if (this.peek() === 'u' || this.peek() === 'U' || this.peek() === 's' || this.peek() === 'S') {
			lexeme += this.advance();
		}
		if (/^[bBsSiIlL]$/.test(this.peek())) {
			lexeme += this.advance();
		}

		return { type: TokenType.NUMBER, lexeme, line: startLine, column: startCol };
	}

	private scanBinaryNumber(): Token {
		const startLine = this.line;
		const startCol = this.col;
		let lexeme = '0b';
		this.pos += 2; this.col += 2;

		while (this.pos < this.source.length && /^[01_]$/.test(this.peek())) {
			const c = this.advance();
			if (c !== '_') lexeme += c;
		}

		if (this.peek() === 'u' || this.peek() === 'U' || this.peek() === 's' || this.peek() === 'S') {
			lexeme += this.advance();
		}
		if (/^[bBsSiIlL]$/.test(this.peek())) {
			lexeme += this.advance();
		}

		return { type: TokenType.NUMBER, lexeme, line: startLine, column: startCol };
	}

	private scanDecimalOrFloat(start: number, startLine: number, startCol: number): Token | null {
		const savePos = this.pos;
		this.pos = start;
		this.col = startCol;

		// Consume digits with optional underscores (the integer part)
		let lexeme = '';
		while (this.pos < this.source.length && /^[\d_]$/.test(this.peek())) {
			lexeme += this.advance();
		}

		const hasDecimalOrExp =
			this.peek() === '.' ||
			this.peek() === 'e' || this.peek() === 'E';

		if (!hasDecimalOrExp) {
			// Plain integer: try type suffix
			if (this.peek() === 'u' || this.peek() === 'U' || this.peek() === 's' || this.peek() === 'S') {
				lexeme += this.advance();
			}
			if (/^[bBsSiIlL]$/.test(this.peek())) {
				lexeme += this.advance();
			}
			if (lexeme.length === 0) {
				this.pos = savePos;
				return null;
			}
			return { type: TokenType.NUMBER, lexeme, line: startLine, column: startCol };
		}

		// Float
		if (this.peek() === '.') {
			lexeme += this.advance(); // consume '.'
			while (this.pos < this.source.length && /^[\d_]$/.test(this.peek())) {
				lexeme += this.advance();
			}
		}

		// Scientific notation
		if (this.peek() === 'e' || this.peek() === 'E') {
			lexeme += this.advance();
			if (this.peek() === '+' || this.peek() === '-') {
				lexeme += this.advance();
			}
			while (this.pos < this.source.length && /^[\d_]$/.test(this.peek())) {
				lexeme += this.advance();
			}
		}

		// Optional float type suffix
		if (/^[fFdD]$/.test(this.peek())) {
			lexeme += this.advance();
		}

		if (lexeme.length === 0) {
			this.pos = savePos;
			return null;
		}
		return { type: TokenType.NUMBER, lexeme, line: startLine, column: startCol };
	}

	private tryScanFloatStartingWithDot(): Token | null {
		if (this.pos + 1 >= this.source.length) return null;
		if (!this.isDigit(this.peek(1))) return null;

		const startLine = this.line;
		const startCol = this.col;
		let lexeme = this.advance(); // '.'

		while (this.pos < this.source.length && /^[\d_]$/.test(this.peek())) {
			lexeme += this.advance();
		}

		// Scientific notation
		if (this.peek() === 'e' || this.peek() === 'E') {
			lexeme += this.advance();
			if (this.peek() === '+' || this.peek() === '-') {
				lexeme += this.advance();
			}
			while (this.pos < this.source.length && /^[\d_]$/.test(this.peek())) {
				lexeme += this.advance();
			}
		}

		if (/^[fFdD]$/.test(this.peek())) {
			lexeme += this.advance();
		}

		return { type: TokenType.NUMBER, lexeme, line: startLine, column: startCol };
	}

	// -------- Booleans and Bare Strings --------
	private scanBareStringOrBoolean(): Token {
		const startLine = this.line;
		const startCol = this.col;
		const buf: string[] = [];

		while (this.pos < this.source.length && /^[a-zA-Z0-9_+\-.]$/.test(this.peek())) {
			buf.push(this.advance());
		}

		const word = buf.join('');

		// Check for boolean (case-insensitive)
		if (word.toLowerCase() === 'true' || word.toLowerCase() === 'false') {
			return { type: TokenType.BOOLEAN, lexeme: word.toLowerCase(), line: startLine, column: startCol };
		}

		return { type: TokenType.BARE_STRING, lexeme: word, line: startLine, column: startCol };
	}

	// -------- Punctuation --------
	private scanPunctuation(): Token | null {
		const ch = this.peek();
		let type: TokenType | null = null;

		switch (ch) {
			case '{': type = TokenType.LBRACE; break;
			case '}': type = TokenType.RBRACE; break;
			case '[': type = TokenType.LBRACKET; break;
			case ']': type = TokenType.RBRACKET; break;
			case '(': type = TokenType.LPAREN; break;
			case ')': type = TokenType.RPAREN; break;
			case ':': type = TokenType.COLON; break;
			case ';': type = TokenType.SEMICOLON; break;
			case ',': type = TokenType.COMMA; break;
		}

		if (type === null) return null;

		const tok = this.makeToken(type, ch);
		this.advance();
		return tok;
	}

	// -------- Helpers --------
	private isDigit(ch: string): boolean {
		return ch >= '0' && ch <= '9';
	}

	private isIdentStart(ch: string): boolean {
		return /^[a-zA-Z_]$/.test(ch);
	}
}

/**
 * Java-style Character.codePointOf for \N{name} support.
 * Uses a minimal mapping of common Unicode character names.
 */
function charCodePointOf(name: string): number {
	const map: Record<string, number> = {
		'SNOWMAN': 0x2603,
		'SPACE': 0x0020,
		'NULL': 0x0000,
		'BACKSPACE': 0x0008,
		'TAB': 0x0009,
		'LINE FEED': 0x000A,
		'FORM FEED': 0x000C,
		'CARRIAGE RETURN': 0x000D,
	};
	return map[name.toUpperCase()] ?? -1;
}
