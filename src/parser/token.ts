export enum TokenType {
	// Brackets
	LBRACE,   // {
	RBRACE,   // }
	LBRACKET, // [
	RBRACKET, // ]
	LPAREN,   // (
	RPAREN,   // )

	// Punctuation
	COLON,    // :
	SEMICOLON,// ;
	COMMA,    // ,

	// Literals
	STRING_DOUBLE, // "..."
	STRING_SINGLE, // '...'
	BARE_STRING,   // unquoted string
	NUMBER,        // numeric literal
	BOOLEAN,       // true / false

	// Special
	OPERATION_PREFIX, // -{}-
	EOF,
}

export interface Token {
	type: TokenType;
	lexeme: string;
	line: number;
	column: number;
}
