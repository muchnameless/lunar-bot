interface Operator {
	precedence: number;
	associativity: OperatorAssociativity;
}

export const enum OperatorAssociativity {
	Left,
	Right,
}

export class Parser {
	table: Record<string, Operator>;

	constructor(table: Record<string, Operator>) {
		this.table = table;
	}

	/**
	 * parses a token list into reverse polish notation
	 * @param input
	 */
	parse(input: (string | number)[]) {
		const output: (string | number)[] = [];
		const stack: (string | number)[] = [];

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
					if (Reflect.has(this.table, token)) {
						let shouldWriteToStack = true;

						while (stack.length) {
							const punctuator = stack.at(-1)!;
							const operator = this.table[token]!;

							if (punctuator === '(') {
								if (operator.associativity === OperatorAssociativity.Right) {
									shouldWriteToStack = false;
									output.push(token);
								}

								break;
							}

							const { precedence } = operator;
							const antecedence = this.table[punctuator]!.precedence;

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
						this.table[stack[nonBracketIndex]!]?.associativity === OperatorAssociativity.Right
					) {
						output.push(stack.splice(nonBracketIndex, 1)[0]!);
					}
				}
			}
		}

		if (stack.includes('(')) throw 'ParserError: mismatched parentheses';

		output.push(...stack.reverse());

		return output;
	}
}
