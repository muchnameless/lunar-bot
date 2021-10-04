declare module 'lex' {
	export type Action = (...lexeme: string[]) => string | number | undefined;

	export type Defunct = (chr: string) => never;

	export interface Match {
		result: RegExpExecArray;
		action: Action;
		length: number;
	}

	export default class Lexer {
		constructor(defunct?: Defunct);

		state: number;
		index: number;
		input: string;

		addRule(pattern: RegExp, action: Action, start?: number[]): this;
		setInput(input: string): this;
		lex(): string | undefined;
		scan(): Match[];

		static defunct: Defunct;
	}
}
