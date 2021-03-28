'use strict';

const { add, sub, mul, div } = require('sinful-math');
const Lexer = require('lex');
const Command = require('../../structures/commands/Command');
// const logger = require('../../functions/logger');


class Parser {
	constructor(table) {
		this.table = table;
	}

	parse(input) {
		const { length } = input;
		const { table } = this;
		const output = [];
		const stack = [];
		let index = 0;

		while (index < length) {
			let token = input[index++];

			switch (token) {
				case '(':
					stack.unshift(token);
					break;
				case ')':
					while (stack.length) {
						token = stack.shift();
						if (token === '(') break;
						else output.push(token);
					}

					if (token !== '(') throw new Error('Mismatched parentheses.');
					break;
				default:
					if (Object.hasOwnProperty.call(table, token)) {
						while (stack.length) {
							const [ punctuator ] = stack;

							if (punctuator === '(') break;

							const operator = table[token];
							const { precedence } = operator;
							const antecedence = table[punctuator].precedence;

							if (precedence > antecedence || (precedence === antecedence && operator.associativity === 'right')) break;

							output.push(stack.shift());
						}

						stack.unshift(token);
					} else output.push(token);
			}
		}

		while (stack.length) {
			const token = stack.shift();
			if (token !== '(') output.push(token);
			else throw new Error('Mismatched parentheses.');
		}

		return output;
	}
}

const lexer = new Lexer()
	.addRule(/[\s,]/, () => void 0) // ignore whitespaces and ','
	.addRule(/(\d+(?:\.\d+)?|\.\d+)|[(+\-*/)^]/, lexeme => lexeme)
	.addRule(/sin(?:e|us)?/i, () => 'sin') // functions
	.addRule(/cos(?:ine|inus)?/i, () => 'cos')
	.addRule(/tan(?:gen[st])?/i, () => 'tan')
	.addRule(/sqrt|squareroot/i, () => 'sqrt')
	.addRule(/exp/i, () => 'exp')
	.addRule(/ln/, () => 'ln')
	.addRule(/log/, () => 'log')
	.addRule(/pi|\u03C0/iu, () => Math.PI) // constants
	.addRule(/e(?:uler)?/i, () => Math.E);

const power = {
	precedence: 4,
	associativity: 'left',
};

const func = {
	precedence: 3,
	associativity: 'left',
};

const factor = {
	precedence: 2,
	associativity: 'left',
};

const term = {
	precedence: 1,
	associativity: 'left',
};

const parser = new Parser({
	'^': power,
	'+': term,
	'-': term,
	'*': factor,
	'/': factor,
	'sin': func,
	'cos': func,
	'tan': func,
	'sqrt': func,
	'exp': func,
	'ln': func,
	'log': func,
});

function parse(input) {
	lexer.setInput(input);
	const tokens = [];
	let token;
	while ((token = lexer.lex())) tokens.push(token);
	// logger.debug({ tokens, parsed: parser.parse(tokens) })
	return parser.parse(tokens);
}

const args2 = {
	'^': (a, b) => a ** b,
	'+': (a = 0, b = 0) => add(a, b), // default values to allow unary operators
	'-': (a = 0, b = 0) => sub(a, b),
	'*': mul,
	'/': (a, b) => (b !== '0' ? div(a, b) : NaN),
	'log': (a, b) => div(Math.log(a), Math.log(b)),
};
const args2Arr = Object.keys(args2);

const args1 = {
	'sin': x => (div(x, Math.PI) === Math.floor(div(x, Math.PI)) ? 0 : Math.sin(x)),
	'cos': x => (div(add(x, div(Math.PI, 2)), Math.PI) === Math.floor(div(add(x, div(Math.PI, 2)), Math.PI)) ? 0 : Math.cos(x)),
	'tan': Math.tan,
	'sqrt': Math.sqrt,
	'exp': Math.exp,
	'ln': Math.log,
};
const args1Arr = Object.keys(args1);


module.exports = class MathCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'calc' ],
			description: 'supports `+`, `-`, `*`, `/`, `^`, `sin`, `cos`, `tan`, `sqrt`, `exp`, `ln`, `log`, `pi`, `e`',
			args: false,
			usage: '',
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(message, args, flags, rawArgs) { // eslint-disable-line no-unused-vars
		const INPUT = rawArgs.join(' ')
			.replace(/\*\*/g, '^')
			.replace(/:/g, '/') // 5:3 -> 5/3
			.replace(/(?<=\d\s*)(?=[a-z])/gi, '*'); // add implicit '*'
		const stack = [];

		let parsed;

		try {
			parsed = parse(INPUT);
		} catch (error) {
			return message.reply(`${error.message.replace(/^[A-Z]/, match => match.toLowerCase()).replace(/\.$/, '')}, input: '${INPUT}'`);
		}

		for (const c of parsed) {
			if (args2Arr.includes(c)) {
				const temp = stack.pop();
				stack.push(args2[c](stack.pop(), temp));
				continue;
			}

			if (args1Arr.includes(c)) {
				stack.push(args1[c](stack.pop()));
				continue;
			}

			stack.push(c);
		}

		const output = stack.pop();
		const PRETTIFIED_INPUT = INPUT
			.replace(/pi/gi, '\u{03C0}'); // prettify 'pi'

		// logger.debug({ input: PRETTIFIED_INPUT, output })

		if (Number.isNaN(Number(output)) || Number.isFinite(Number(output))) return message.reply(`${PRETTIFIED_INPUT} = ${output}`);

		message.reply(`input evaluates to a value larger than ${message.client.formatNumber(Number.MAX_SAFE_INTEGER)}`);
	}
};
