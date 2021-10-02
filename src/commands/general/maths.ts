import { SlashCommandBuilder } from '@discordjs/builders';
import pkg from 'sinful-math';
const { add, sub, mul, div } = pkg;
import Lexer from 'lex';
import { InteractionUtil } from '../../util';
import { DualCommand } from '../../structures/commands/DualCommand';
import type { CommandInteraction } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';
import type { HypixelMessage } from '../../structures/chat_bridge/HypixelMessage';


interface Operator {
	precedence: number;
	associativity: 'left' | 'right';
}


class Parser {
	table: Record<string, Operator>;

	constructor(table: Record<string, Operator>) {
		this.table = table;
	}

	/**
	 * parses a token list into reverse polish notation
	 * @param input
	 */
	parse(input: string[]) {
		const output: string[] = [];
		const stack: string[] = [];

		for (let token of input) {
			switch (token) {
				case '(':
					stack.unshift(token);
					break;

				case ')':
					while (stack.length) {
						token = stack.shift()!;
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
							const [ punctuator ] = stack;
							const operator = this.table[token];

							if (punctuator === '(') {
								if (operator.associativity === 'right') {
									shouldWriteToStack = false;
									output.push(token);
								}
								break;
							}

							const { precedence } = operator;
							const antecedence = this.table[punctuator].precedence;

							if (precedence > antecedence || (precedence === antecedence && operator.associativity === 'right')) break;

							output.push(stack.shift()!);
						}

						if (shouldWriteToStack) stack.unshift(token);

						continue;
					}

					// token is not an operator
					output.push(token);

					// check if token is followed by a unary operator
					const nonBracketIndex = stack.findIndex(x => x !== '(');

					if (nonBracketIndex !== -1 && this.table[stack[nonBracketIndex]]?.associativity === 'right') {
						output.push(stack.splice(nonBracketIndex, 1)[0]);
					}
				}
			}
		}

		if (stack.includes('(')) throw new Error('ParserError: mismatched parentheses');

		output.push(...stack);

		return output;
	}
}


export default class MathsCommand extends DualCommand {
	constructor(context: CommandContext) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('supports: + - * / ^ ! % sin cos tan sqrt exp ln log pi e')
				.addStringOption(option => option
					.setName('input')
					.setDescription('mathematical expression to evaluate')
					.setRequired(true),
				),
			cooldown: 0,
		}, {
			aliases: [ 'm' ],
			args: true,
			usage: '',
		});
	}

	static percent = {
		precedence: 8,
		associativity: 'right',
	} as const;
	static multiplier = {
		precedence: 7,
		associativity: 'right',
	} as const;
	static degree = {
		precedence: 6,
		associativity: 'right',
	} as const;
	static factorialPost = {
		precedence: 5,
		associativity: 'right',
	} as const;
	static factorialPre = {
		precedence: 5,
		associativity: 'left',
	} as const;
	static power = {
		precedence: 4,
		associativity: 'left',
	} as const;
	static func = {
		precedence: 3,
		associativity: 'left',
	} as const;
	static factor = {
		precedence: 2,
		associativity: 'left',
	} as const;
	static term = {
		precedence: 1,
		associativity: 'left',
	} as const;

	unaryOperators = {
		m(x = 1) {
			return mul(x, 1_000_000);
		},
		k(x = 1) {
			return mul(x, 1_000);
		},
		'°'(x?: number) {
			if (typeof x === 'undefined') throw new Error('`degree` requires one argument');
			return mul(x, div(Math.PI, 180));
		},
		'!': (x?: number) => {
			if (typeof x === 'undefined') throw new Error('`fac` requires one argument');
			if (x < 0) return Number.NaN;
			return this.factorial(x);
		},
		fac: (x?: number) => {
			if (typeof x === 'undefined') throw new Error('`fac` requires one argument');
			if (x < 0) return Number.NaN;
			return this.factorial(x);
		},
		sin(x?: number) {
			if (typeof x === 'undefined') throw new Error('`sin` requires one argument');
			if (MathsCommand.isMultipleOfPi(x)) return 0;
			return Math.sin(x);
		},
		cos(x?: number) {
			if (typeof x === 'undefined') throw new Error('`cos` requires one argument');
			if (MathsCommand.isMultipleOfPiHalf(x)) return 0;
			return Math.cos(x);
		},
		tan(x?: number) {
			if (typeof x === 'undefined') throw new Error('`tan` requires one argument');
			if (MathsCommand.isMultipleOfPi(x)) return 0;
			if (MathsCommand.isMultipleOfPiHalf(x)) return Number.NaN;
			return Math.tan(x);
		},
		sqrt(x?: number) {
			if (typeof x === 'undefined') throw new Error('`sqrt` requires one argument');
			return Math.sqrt(x);
		},
		exp(x?: number) {
			if (typeof x === 'undefined') throw new Error('`exp` requires one argument');
			return Math.exp(x);
		},
		ln(x?: number) {
			if (typeof x === 'undefined') throw new Error('`ln` requires one argument');
			return Math.log(x);
		},
		percent(x?: number) {
			if (typeof x === 'undefined') throw new Error('`%` requires one argument');
			return div(x, 100);
		},
	} as const;

	static binaryOperators = {
		'^'(a?: number, b?: number) {
			if (typeof a === 'undefined') throw new Error('`^` is not an unary operator');
			if (a == 0 && b == 0) return Number.NaN;
			return a ** b!;
		},
		'+': (a?: number, b?: number) => (typeof a !== 'undefined' ? add(a, b!) : b!),
		'-': (a?: number, b?: number) => (typeof a !== 'undefined' ? sub(a, b!) : -b!),
		'*'(a?: number, b?: number) {
			if (typeof a === 'undefined') throw new Error('`*` is not an unary operator');
			return mul(a, b!);
		},
		'/'(a?: number, b?: number) {
			if (typeof a === 'undefined') throw new Error('`/` is not an unary operator');
			if (b == 0) return Number.NaN;
			return div(a, b!);
		},
		log(a?: number, b?: number) {
			if (typeof a === 'undefined') throw new Error('`log` requires two arguments (use `ln` for base e)');
			if (a <= 0 || b! <= 0) return Number.NaN;
			return div(Math.log(a), Math.log(b!));
		},
	} as const;

	/**
	 * @param start
	 */
	factorial = (start: number) => {
		let temp = 1;
		let iterations = start;
		while (iterations > 0) {
			temp *= iterations--;
			this.validateNumber(temp);
		}
		return temp;
	};

	static isMultipleOfPi = (x: number) => div(x, Math.PI) === Math.floor(div(x, Math.PI));

	static isMultipleOfPiHalf = (x: number) => div(add(x, div(Math.PI, 2)), Math.PI) === Math.floor(div(add(x, div(Math.PI, 2)), Math.PI));

	/**
	 * lexer for mathematical expressions
	 */
	static lexer = new Lexer(function(c: string) { // eslint-disable-line prefer-arrow-callback
		// @ts-expect-error
		throw new Error(`LexerError: unexpected character at index ${(this as Lexer).index}: '${c}'`);
	})
		.addRule(/,/, () => void 0) // ignore ','
		.addRule(/(?:(?<=[(*+/^-]\s*)-)?(\d+(?:\.\d+)?|\.\d+)|[!()*+/^°-]/, (lexeme: string) => lexeme)
		.addRule(/sin(?:e|us)?/i, () => 'sin') // functions
		.addRule(/cos(?:ine|inus)?/i, () => 'cos')
		.addRule(/tan(?:gen[st])?/i, () => 'tan')
		.addRule(/sqrt|squareroot/i, () => 'sqrt')
		.addRule(/exp/i, () => 'exp')
		.addRule(/ln/, () => 'ln')
		.addRule(/log/, () => 'log')
		.addRule(/fac(?:ulty)?/, () => 'fac')
		.addRule(/%/, () => 'percent')
		.addRule(/pi|\u03C0/iu, () => Math.PI) // constants
		.addRule(/e(?:uler)?/i, () => Math.E)
		.addRule(/m|k/i, (lexeme: string) => lexeme.toLowerCase()); // multiplier

	/**
	 * parser for reverse polish notation
	 */
	static parser = new Parser({
		m: this.multiplier,
		k: this.multiplier,
		'°': this.degree,
		'^': this.power,
		'!': this.factorialPost,
		fac: this.factorialPre,
		'+': this.term,
		'-': this.term,
		'*': this.factor,
		'/': this.factor,
		sin: this.func,
		cos: this.func,
		tan: this.func,
		sqrt: this.func,
		exp: this.func,
		ln: this.func,
		log: this.func,
		percent: this.percent,
	});

	static parse(input: string) {
		MathsCommand.lexer.setInput(input);
		const tokens: string[] = [];
		let token;
		while ((token = MathsCommand.lexer.lex())) tokens.push(token);
		// logger.debug({ tokens })
		if (!tokens.length) throw new Error('LexerError: token list empty');
		return MathsCommand.parser.parse(tokens);
	}

	/**
	 * throws if the input is larger than Number.MAX_SAFE_INTEGER, returns the value otherwise
	 * @param value
	 */
	validateNumber(value?: string | number) {
		if (Math.abs(Number(value)) > Number.MAX_SAFE_INTEGER) throw new Error(`(intermediate) result larger than ${this.client.formatNumber(Number.MAX_SAFE_INTEGER)}`);

		return value;
	}

	/**
	 * formats a number string
	 * @param x
	 */
	static formatNumberString = (x: string) => x.replace(/(?<!\..*)\B(?=(\d{3})+(?!\d))/gs, '\u{202F}');

	calculate(rawInput: string) {
		/**
		 * generate input string
		 */
		const INPUT = rawInput
			.replaceAll('**', '^') // 5**3 -> 5^3
			.replaceAll(':', '/') // 5:3 -> 5/3
			.replace(/(?<=[\d)]\s*)(?=[(a-jln-z])/gi, '*') // add implicit '*' between numbers before letters and '('
			.replace(/(?<=\*)x/gi, '') // 5x3 -> 5*3
			.replace(/=$/, ''); // 5*3= -> 5*3

		let parsed;

		// parse
		try {
			parsed = MathsCommand.parse(INPUT);
		} catch (error) {
			throw `${error instanceof Error ? error.message : error}, input: '${INPUT}'`;
		}

		// logger.debug({ parsed })

		const stack: (number | string)[] = [];

		let output;

		// calculate
		try {
			const pop = () => this.validateNumber(stack.pop());

			for (const token of parsed) {
				if (Reflect.has(MathsCommand.binaryOperators, token)) {
					const b = pop();
					const a = pop();

					stack.push(MathsCommand.binaryOperators[token](a, b));
					continue;
				}

				if (Reflect.has(this.unaryOperators, token)) {
					const a = pop();

					stack.push(this.unaryOperators[token](a));
					continue;
				}

				stack.push(token);
			}

			output = pop();

			if (stack.length !== 0) throw new Error('unprocessed parts');
		} catch (error) {
			throw `CalculationError: ${error instanceof Error ? error.message : error}, input: '${INPUT}'`;
		}

		// logger.debug({ input: PRETTIFIED_INPUT, output })

		return {
			input: MathsCommand.formatNumberString(INPUT)
				.replace(/(?<=.)[*+/-]/g, ' $& ') // add spaces around operators
				.replaceAll(',', '$& ') // add space after commas
				.replace(/pi/gi, '\u{03C0}'), // prettify 'pi'
			output: Number(output),
			formattedOutput: MathsCommand.formatNumberString(output?.toString() ?? ''),
		};
	}

	/**
	 * execute the command
	 * @param rawInput
	 */
	#generateReply(rawInput: string) {
		try {
			const { input, formattedOutput } = this.calculate(rawInput);

			return `${input} = ${formattedOutput}`;
		} catch (error) {
			return `${error}`;
		}
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override runSlash(interaction: CommandInteraction) {
		return InteractionUtil.reply(interaction, this.#generateReply(interaction.options.getString('input', true)));
	}

	/**
	 * execute the command
	 * @param hypixelMessage
	 */
	override runMinecraft(hypixelMessage: HypixelMessage<true>) {
		return hypixelMessage.reply(this.#generateReply(hypixelMessage.commandData!.args!.join('')));
	}
}
