import { ParseError } from './ast';

export function makeError(message: string, line: number, column: number, length = 1): ParseError {
	return { message, line, column, length };
}
