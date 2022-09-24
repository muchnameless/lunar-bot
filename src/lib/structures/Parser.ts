interface Operator {
	associativity: OperatorAssociativity;
	precedence: number;
}

export const enum OperatorAssociativity {
	Left,
	Right,
}

export class Parser {
	private readonly _table: Record<string, Operator>;

	public constructor(table: Record<string, Operator>) {
		this._table = table;
	}

	/**
	 * parses a token list into reverse polish notation
	 *
	 * @param input
	 */
	public parse(input: (number | string)[]) {
		const output: (number | string)[] = [];
		const stack: (number | string)[] = [];

		for (let token of input) {
			switch (token) {
				case '(':
					stack.push(token);
					break;

				case ')':
					while (stack.length) {
						token = stack.pop()!;
						if (token === '(') break;
						output.push(token);
					}

					if (token !== '(') throw new Error('ParserError: mismatched parentheses');
					break;

				default: {
					// token is an operator
					if (token in this._table) {
						let shouldWriteToStack = true;

						while (stack.length) {
							const punctuator = stack.at(-1)!;
							const operator = this._table[token]!;

							if (punctuator === '(') {
								if (operator.associativity === OperatorAssociativity.Right) {
									shouldWriteToStack = false;
									output.push(token);
								}

								break;
							}

							const { precedence } = operator;
							const antecedence = this._table[punctuator]!.precedence;

							if (
								precedence > antecedence ||
								(precedence === antecedence && operator.associativity === OperatorAssociativity.Right)
							) {
								break;
							}

							output.push(stack.pop()!);
						}

						if (shouldWriteToStack) stack.push(token);

						continue;
					}

					// token is not an operator
					output.push(token);

					// check if token is followed by a unary operator
					const nonBracketIndex = stack.findLastIndex((x) => x !== '(');

					if (
						nonBracketIndex !== -1 &&
						this._table[stack[nonBracketIndex]!]?.associativity === OperatorAssociativity.Right
					) {
						output.push(stack.splice(nonBracketIndex, 1)[0]!);
					}
				}
			}
		}

		if (stack.includes('(')) throw 'ParserError: mismatched parentheses';

		for (let index = stack.length - 1; index >= 0; --index) {
			output.push(stack[index]!);
		}

		return output;
	}
}
