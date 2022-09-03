/* eslint-disable id-length */
import { TextInputLimits } from '@sapphire/discord-utilities';
import {
	ActionRowBuilder,
	escapeMarkdown,
	InteractionType,
	ModalBuilder,
	SlashCommandBuilder,
	TextInputBuilder,
	TextInputStyle,
	type ChatInputCommandInteraction,
	type ModalActionRowComponentBuilder,
	type ModalSubmitInteraction,
} from 'discord.js';
import BigDecimal from 'js-big-decimal';
import { type HypixelUserMessage } from '#chatBridge/HypixelMessage.js';
import { formatNumber, trim } from '#functions';
import { logger } from '#logger';
import { Lexer } from '#structures/Lexer.js';
import { OperatorAssociativity, Parser } from '#structures/Parser.js';
import { type CommandContext } from '#structures/commands/BaseCommand.js';
import { DualCommand } from '#structures/commands/DualCommand.js';
import { InteractionUtil, type ModalRepliableInteraction, type RepliableInteraction } from '#utils';

export default class MathsCommand extends DualCommand {
	/**
	 * >= 10 -> sin(90°) = 0
	 * >= 18 -> cos(90°) = 1
	 */
	private readonly precision = 18;

	public constructor(context: CommandContext) {
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
			},
		);
	}

	private readonly percent = {
		precedence: 8,
		associativity: OperatorAssociativity.Right,
	} as const;

	private readonly multiplier = {
		precedence: 7,
		associativity: OperatorAssociativity.Right,
	} as const;

	private readonly degree = {
		precedence: 6,
		associativity: OperatorAssociativity.Right,
	} as const;

	private readonly factorialPost = {
		precedence: 5,
		associativity: OperatorAssociativity.Right,
	} as const;

	private readonly factorialPre = {
		precedence: 5,
		associativity: OperatorAssociativity.Left,
	} as const;

	private readonly func = {
		precedence: 4,
		associativity: OperatorAssociativity.Left,
	} as const;

	private readonly power = {
		precedence: 3,
		associativity: OperatorAssociativity.Left,
	} as const;

	private readonly factor = {
		precedence: 2,
		associativity: OperatorAssociativity.Left,
	} as const;

	private readonly term = {
		precedence: 1,
		associativity: OperatorAssociativity.Left,
	} as const;

	private readonly unaryOperators = {
		m: (x = 1) => {
			return BigDecimal.multiply(x, 1_000_000);
		},
		k: (x = 1) => {
			return BigDecimal.multiply(x, 1_000);
		},
		'°': (x?: number) => {
			if (typeof x === 'undefined') throw new Error('`degree` requires one argument');
			return BigDecimal.multiply(x, BigDecimal.divide(Math.PI, 180, this.precision));
		},
		'!': (x?: number) => {
			if (typeof x === 'undefined') throw new Error('`fac` requires one argument');
			if (x < 0) return Number.NaN;
			return this._factorial(x);
		},
		fac: (x?: number) => {
			if (typeof x === 'undefined') throw new Error('`fac` requires one argument');
			if (x < 0) return Number.NaN;
			return this._factorial(x);
		},
		sin: (x?: number) => {
			if (typeof x === 'undefined') throw new Error('`sin` requires one argument');
			if (this._isMultipleOfPi(x)) return 0;
			return Math.sin(x);
		},
		cos: (x?: number) => {
			if (typeof x === 'undefined') throw new Error('`cos` requires one argument');
			if (this._isMultipleOfPiHalf(x)) return 0;
			return Math.cos(x);
		},
		tan: (x?: number) => {
			if (typeof x === 'undefined') throw new Error('`tan` requires one argument');
			if (this._isMultipleOfPi(x)) return 0;
			if (this._isMultipleOfPiHalf(x)) return Number.NaN;
			return Math.tan(x);
		},
		sqrt: (x?: number) => {
			if (typeof x === 'undefined') throw new Error('`sqrt` requires one argument');
			return Math.sqrt(x);
		},
		exp: (x?: number) => {
			if (typeof x === 'undefined') throw new Error('`exp` requires one argument');
			return Math.exp(x);
		},
		ln: (x?: number) => {
			if (typeof x === 'undefined') throw new Error('`ln` requires one argument');
			return Math.log(x);
		},
		percent: (x?: number) => {
			if (typeof x === 'undefined') throw new Error('`%` requires one argument');
			return BigDecimal.divide(x, 100, this.precision);
		},
	} as const;

	private readonly binaryOperators = {
		'^': (a?: number, b?: number) => {
			if (typeof a === 'undefined') throw new Error('`^` is not a unary operator');
			if (a === 0 && b === 0) return Number.NaN;
			return a ** b!;
		},
		'+': (a?: number, b?: number) => (typeof a === 'undefined' ? b! : BigDecimal.add(a, b)),
		'-': (a?: number, b?: number) => (typeof a === 'undefined' ? BigDecimal.negate(b) : BigDecimal.subtract(a, b)),
		'*': (a?: number, b?: number) => {
			if (typeof a === 'undefined') throw new Error('`*` is not a unary operator');
			return BigDecimal.multiply(a, b!);
		},
		'/': (a?: number, b?: number) => {
			if (typeof a === 'undefined') throw new Error('`/` is not a unary operator');
			if (b === 0) return Number.NaN;
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
	private _factorial(start: number) {
		let temp = 1;
		let iterations = start;
		while (iterations > 0) {
			temp *= iterations--;
			this._validateNumber(temp);
		}

		return temp;
	}

	/**
	 * helper method to ensure that sin(pi) = 0
	 *
	 * @param x
	 */
	private _isMultipleOfPi(x: number) {
		return (
			Number(BigDecimal.divide(x, Math.PI, this.precision)) ===
			Number(BigDecimal.floor(BigDecimal.divide(x, Math.PI, this.precision)))
		);
	}

	/**
	 * helper method to ensure that cos(pi/2) = 0
	 *
	 * @param x
	 */
	private _isMultipleOfPiHalf(x: number) {
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
	private lexer = new Lexer()
		.addRule(/,/, () => null) // ignore ','
		.addRule(/(?:(?<=[(*+/^-])-)?(?:\d+(?:\.\d+)?|\.\d+)/) // numbers
		.addRule(/(?<![+-])[)*/^]/) // operators which should not follow after unary prefix operators
		.addRule(/\(/) // operators which can be anywhere
		.addRule(/[+-](?!$)/) // unary prefix
		.addRule(/(?<!^|[(*+/^-])[!°]/) // unary postfix (include prev rules matches in lookbehind)
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
		// eslint-disable-next-line unicorn/consistent-function-scoping
		.addRule(/(?<=\d)[km]/i, (x) => x.toLowerCase()); // multiplier

	/**
	 * parser for reverse polish notation
	 */
	private parser = new Parser({
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

	private _parse(input: string) {
		const tokens: (number | string)[] = [];

		let token: number | string | null;

		this.lexer.setInput(input);

		while ((token = this.lexer.lex())) tokens.push(token);

		// logger.debug({ tokens });

		if (!tokens.length) throw 'LexerError: token list empty';

		return this.parser.parse(tokens);
	}

	/**
	 * throws if the input is larger than Number.MAX_SAFE_INTEGER, returns the value otherwise
	 *
	 * @param value
	 */
	private _validateNumber(value?: number | string) {
		if (Math.abs(Number(value)) > Number.MAX_SAFE_INTEGER) {
			throw `(intermediate) result larger than ${formatNumber(Number.MAX_SAFE_INTEGER)}`;
		}

		if (typeof value === 'string') return Number(value);
		return value;
	}

	/**
	 * formats a number string
	 *
	 * @param input
	 */
	private _formatNumberString(input: string) {
		return input.replace(/(?<!\..*)\B(?=(?:\d{3})+(?!\d))/gs, '\u{202F}');
	}

	/**
	 * lexes, parses and evaluates the input
	 *
	 * @param rawInput
	 */
	public calculate(rawInput: string) {
		// generate input string
		const INPUT = rawInput
			.replace(/\s+/g, '') // remove spaces
			.replaceAll('_', '') // 1_000 -> 1000
			.replaceAll('**', '^') // 5**3 -> 5^3
			.replaceAll(':', '/') // 5:3 -> 5/3
			.replace(/(?<=\d)e(?=-?\d)/gi, '*10^') // 5e3 -> 5*10^3
			.replace(/(?<=[\d)])(?=[(a-jln-z])/gi, '*') // add implicit '*' between numbers before letters and '('
			.replace(/(?<=\*)x/gi, '') // 5x3 -> 5*3
			.replace(/=$/, ''); // 5*3= -> 5*3

		let parsed: (number | string)[];

		// parse
		try {
			parsed = this._parse(INPUT);
		} catch (error) {
			throw `${error instanceof Error ? error.message : error}, input: \`${INPUT}\``;
		}

		// logger.debug({ rawInput, INPUT, parsed });

		const stack: (number | string)[] = [];

		let output: number | undefined;

		// calculate
		try {
			const pop = () => this._validateNumber(stack.pop());

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
		} catch (error) {
			throw `CalculationError: ${error instanceof Error ? error.message : error}, input: \`${INPUT}\``;
		}

		if (stack.length) throw `CalculationError: unprocessed parts, input: \`${INPUT}\``;

		// logger.debug({ input: PRETTIFIED_INPUT, output })

		return {
			input: this._formatNumberString(INPUT)
				.replace(/(?<=.)[*+/-]/g, ' $& ') // add spaces around operators
				.replaceAll(',', '$& ') // add space after commas
				.replace(/pi/gi, '\u{03C0}'), // prettify 'pi'
			output: Number(output),
			formattedOutput: this._formatNumberString(output?.toString() ?? ''),
		};
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 * @param rawInput
	 */
	private async _sharedRun(interaction: ModalRepliableInteraction | RepliableInteraction, rawInput: string) {
		try {
			const { input, formattedOutput } = this.calculate(rawInput);

			return InteractionUtil.reply(interaction, escapeMarkdown(`${input} = ${formattedOutput}`, { inlineCode: false }));
		} catch (error) {
			if (interaction.type === InteractionType.ModalSubmit) {
				return InteractionUtil.reply(interaction, escapeMarkdown(`${error}`, { inlineCode: false }));
			}

			try {
				const ERROR_MESSAGE = trim(`${error}`, TextInputLimits.MaximumValueCharacters);

				// eslint-disable-next-line @typescript-eslint/return-await
				return await InteractionUtil.showModal(
					interaction as ModalRepliableInteraction,
					new ModalBuilder()
						.setTitle('Maths')
						.setCustomId(this.baseCustomId)
						.addComponents(
							new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
								new TextInputBuilder()
									.setCustomId('input')
									.setStyle(TextInputStyle.Short)
									.setLabel('New input')
									.setValue(trim(rawInput, TextInputLimits.MaximumValueCharacters))
									.setPlaceholder(trim(rawInput, TextInputLimits.MaximumPlaceholderCharacters))
									.setRequired(true),
							),
							new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
								new TextInputBuilder()
									.setCustomId('error')
									.setStyle(TextInputStyle.Paragraph)
									.setLabel('Error')
									.setValue(trim(ERROR_MESSAGE, TextInputLimits.MaximumValueCharacters))
									.setPlaceholder(trim(ERROR_MESSAGE, TextInputLimits.MaximumPlaceholderCharacters))
									.setMaxLength(Math.min(ERROR_MESSAGE.length, TextInputLimits.MaximumValueCharacters))
									.setRequired(false),
							),
						),
				);
			} catch (_error) {
				logger.error(_error, '[MATHS]: modal');
				return InteractionUtil.reply(interaction, escapeMarkdown(`${error}`, { inlineCode: false }));
			}
		}
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 */
	public override async modalSubmitRun(interaction: ModalSubmitInteraction<'cachedOrDM'>) {
		return this._sharedRun(interaction, interaction.fields.getTextInputValue('input'));
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 */
	public override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		return this._sharedRun(interaction, interaction.options.getString('input', true));
	}

	/**
	 * execute the command
	 *
	 * @param hypixelMessage
	 */
	public override minecraftRun(hypixelMessage: HypixelUserMessage) {
		try {
			const { input, formattedOutput } = this.calculate(hypixelMessage.commandData.args.join(''));

			return hypixelMessage.reply(`${input} = ${formattedOutput}`);
		} catch (error) {
			return hypixelMessage.reply(`${error}`);
		}
	}
}
