declare module 'lex' {
	type Action = (...lexeme: string[]) => string | number | undefined;

	type Defunct = (chr: string) => never;

	interface Match {
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
