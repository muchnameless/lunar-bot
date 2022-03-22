import { SlashCommandBuilder } from '@discordjs/builders';
import BigDecimal from 'js-big-decimal';
import Lexer from 'lex';
import { Util } from 'discord.js';
import { InteractionUtil } from '../../util';
import { DualCommand } from '../../structures/commands/DualCommand';
import { formatNumber } from '../../functions';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';
import type { HypixelUserMessage } from '../../structures/chat_bridge/HypixelMessage';

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
							const [punctuator] = stack;
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
					const nonBracketIndex = stack.findIndex((x) => x !== '(');

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
	/**
	 * >= 10 -> sin(90°) = 0
	 * >= 18 -> cos(90°) = 1
	 */
	precision = 18;

	constructor(context: CommandContext) {
		super(
			context,
			{
				slash: new SlashCommandBuilder()
					.setDescription('supports: + - * / ^ ! % sin cos tan sqrt exp ln log pi e')
					.addStringOption((option) =>
						option //
							.setName('input')
							.setDescription('mathematical expression to evaluate')
							.setRequired(true),
					),
				cooldown: 0,
			},
			{
				aliases: ['m'],
				args: true,
				usage: '',
			},
		);
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
			return BigDecimal.multiply(x, 1_000_000);
		},
		k(x = 1) {
			return BigDecimal.multiply(x, 1_000);
		},
		'°': (x?: number) => {
			if (typeof x === 'undefined') throw new Error('`degree` requires one argument');
			return BigDecimal.multiply(x, BigDecimal.divide(Math.PI, 180, this.precision));
		},
		'!'(x?: number) {
			if (typeof x === 'undefined') throw new Error('`fac` requires one argument');
			if (x < 0) return Number.NaN;
			return MathsCommand.factorial(x);
		},
		fac(x?: number) {
			if (typeof x === 'undefined') throw new Error('`fac` requires one argument');
			if (x < 0) return Number.NaN;
			return MathsCommand.factorial(x);
		},
		sin: (x?: number) => {
			if (typeof x === 'undefined') throw new Error('`sin` requires one argument');
			if (this.isMultipleOfPi(x)) return 0;
			return Math.sin(x);
		},
		cos: (x?: number) => {
			if (typeof x === 'undefined') throw new Error('`cos` requires one argument');
			if (this.isMultipleOfPiHalf(x)) return 0;
			return Math.cos(x);
		},
		tan: (x?: number) => {
			if (typeof x === 'undefined') throw new Error('`tan` requires one argument');
			if (this.isMultipleOfPi(x)) return 0;
			if (this.isMultipleOfPiHalf(x)) return Number.NaN;
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
		percent: (x?: number) => {
			if (typeof x === 'undefined') throw new Error('`%` requires one argument');
			return BigDecimal.divide(x, 100, this.precision);
		},
	} as const;

	binaryOperators = {
		'^'(a?: number, b?: number) {
			if (typeof a === 'undefined') throw new Error('`^` is not a unary operator');
			if (a == 0 && b == 0) return Number.NaN;
			return a ** b!;
		},
		'+': (a?: number, b?: number) => (typeof a !== 'undefined' ? BigDecimal.add(a, b) : b!),
		'-': (a?: number, b?: number) => (typeof a !== 'undefined' ? BigDecimal.subtract(a, b) : BigDecimal.negate(b)),
		'*'(a?: number, b?: number) {
			if (typeof a === 'undefined') throw new Error('`*` is not a unary operator');
			return BigDecimal.multiply(a, b!);
		},
		'/': (a?: number, b?: number) => {
			if (typeof a === 'undefined') throw new Error('`/` is not a unary operator');
			if (b == 0) return Number.NaN;
			return BigDecimal.divide(a, b!, this.precision);
		},
		log: (a?: number, b?: number) => {
			if (typeof a === 'undefined') throw new Error('`log` requires two arguments (use `ln` for base e)');
			if (a <= 0 || b! <= 0) return Number.NaN;
			return BigDecimal.divide(Math.log(a), Math.log(b!), this.precision);
		},
	} as const;

	/**
	 * @param start
	 */
	static factorial = (start: number) => {
		let temp = 1;
		let iterations = start;
		while (iterations > 0) {
			temp *= iterations--;
			this.validateNumber(temp);
		}
		return temp;
	};

	/**
	 * helper method to ensure that sin(pi) = 0
	 * @param x
	 */
	isMultipleOfPi(x: number) {
		return (
			Number(BigDecimal.divide(x, Math.PI, this.precision)) ===
			Number(BigDecimal.floor(BigDecimal.divide(x, Math.PI, this.precision)))
		);
	}

	/**
	 * helper method to ensure that cos(pi/2) = 0
	 * @param x
	 */
	isMultipleOfPiHalf(x: number) {
		return (
			Number(
				BigDecimal.divide(BigDecimal.add(x, BigDecimal.divide(Math.PI, 2, this.precision)), Math.PI, this.precision),
			) ===
			Number(
				BigDecimal.floor(
					BigDecimal.divide(BigDecimal.add(x, BigDecimal.divide(Math.PI, 2, this.precision)), Math.PI, this.precision),
				),
			)
		);
	}

	/**
	 * lexer for mathematical expressions
	 */
	static lexer = new Lexer((c: string) => {
		throw new Error(`LexerError: unexpected character '${c}' at index ${this.lexer.index}`);
	})
		.addRule(/,/, () => void 0) // ignore ','
		.addRule(/(?:(?<=[(*+/^-]\s*)-)?(\d+(?:\.\d+)?|\.\d+)/, (lexeme: string) => lexeme) // numbers
		.addRule(/(?<![+-])[)/^*]/, (lexeme: string) => lexeme) // operators which should not follow after unary prefix operators
		.addRule(/\(/, (lexeme: string) => lexeme) // operators which can be anywhere
		.addRule(/[+-](?!$)/, (lexeme: string) => lexeme) // unary prefix
		.addRule(/(?<!^|[(/^*+-])[°!]/, (lexeme: string) => lexeme) // unary postfix (include prev rules matches in lookbehind)
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
		.addRule(/(?<=\d)[mk]/i, (lexeme: string) => lexeme.toLowerCase()); // multiplier

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
		let token: string | undefined;
		while ((token = MathsCommand.lexer.lex())) tokens.push(token);
		// logger.debug({ tokens });
		if (!tokens.length) throw new Error('LexerError: token list empty');
		return MathsCommand.parser.parse(tokens);
	}

	/**
	 * throws if the input is larger than Number.MAX_SAFE_INTEGER, returns the value otherwise
	 * @param value
	 */
	static validateNumber(value?: string | number) {
		if (Math.abs(Number(value)) > Number.MAX_SAFE_INTEGER) {
			throw new Error(`(intermediate) result larger than ${formatNumber(Number.MAX_SAFE_INTEGER)}`);
		}

		if (typeof value === 'string') return Number(value);
		return value;
	}

	/**
	 * formats a number string
	 * @param x
	 */
	static formatNumberString = (x: string) => x.replace(/(?<!\..*)\B(?=(?:\d{3})+(?!\d))/gs, '\u{202F}');

	calculate(rawInput: string) {
		/**
		 * generate input string
		 */
		const INPUT = rawInput
			.replaceAll(' ', '') // remove spaces
			.replaceAll('_', '') // 1_000 -> 1000
			.replaceAll('**', '^') // 5**3 -> 5^3
			.replaceAll(':', '/') // 5:3 -> 5/3
			.replace(/(?<=[\d)]\s*)(?=[(a-jln-z])/gi, '*') // add implicit '*' between numbers before letters and '('
			.replace(/(?<=\*)x/gi, '') // 5x3 -> 5*3
			.replace(/=$/, ''); // 5*3= -> 5*3

		let parsed: string[];

		// parse
		try {
			parsed = MathsCommand.parse(INPUT);
		} catch (error) {
			throw `${error instanceof Error ? error.message : error}, input: '${INPUT}'`;
		}

		// logger.debug({ rawInput, INPUT, parsed });

		const stack: (number | string)[] = [];

		let output: number | undefined;

		// calculate
		try {
			const pop = () => MathsCommand.validateNumber(stack.pop());

			for (const token of parsed) {
				if (Reflect.has(this.binaryOperators, token)) {
					const b = pop();
					const a = pop();

					stack.push(this.binaryOperators[token as keyof MathsCommand['binaryOperators']](a, b));
					continue;
				}

				if (Reflect.has(this.unaryOperators, token)) {
					const a = pop();

					stack.push(this.unaryOperators[token as keyof MathsCommand['unaryOperators']](a));
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
	private _generateReply(rawInput: string) {
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
	override runSlash(interaction: ChatInputCommandInteraction) {
		return InteractionUtil.reply(
			interaction,
			Util.escapeMarkdown(this._generateReply(interaction.options.getString('input', true))),
		);
	}

	/**
	 * execute the command
	 * @param hypixelMessage
	 */
	override runMinecraft(hypixelMessage: HypixelUserMessage) {
		return hypixelMessage.reply(this._generateReply(hypixelMessage.commandData.args.join('')));
	}
}
