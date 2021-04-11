'use strict';

const { add, sub, mul, div } = require('sinful-math');
const Lexer = require('lex');
const Command = require('../../structures/commands/Command');
const { removeFlagsFromArray } = require('../../functions/util');
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
	.addRule(/(?:(?<=[(+\-*/^]\s*)-)?(\d+(?:\.\d+)?|\.\d+)|[(+\-*/)^!°]/, lexeme => lexeme)
	.addRule(/sin(?:e|us)?/i, () => 'sin') // functions
	.addRule(/cos(?:ine|inus)?/i, () => 'cos')
	.addRule(/tan(?:gen[st])?/i, () => 'tan')
	.addRule(/sqrt|squareroot/i, () => 'sqrt')
	.addRule(/exp/i, () => 'exp')
	.addRule(/ln/, () => 'ln')
	.addRule(/log/, () => 'log')
	.addRule(/fac(?:ulty)?/, () => 'fac')
	.addRule(/pi|\u03C0/iu, () => Math.PI) // constants
	.addRule(/e(?:uler)?/i, () => Math.E);

const degree = {
	precedence: 6,
	associativity: 'right',
};

const factorialPost = {
	precedence: 5,
	associativity: 'right',
};

const factorialPre = {
	precedence: 5,
	associativity: 'left',
};

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
	'°': degree,
	'^': power,
	'!': factorialPost,
	'fac': factorialPre,
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
	'^'(a, b) {
		if (typeof a === 'undefined') throw new Error('`^` is not an unary operator');
		if (a == 0 && b == 0) return NaN;
		return a ** b;
	},
	'+': (a, b) => (typeof a !== 'undefined' ? add(a, b) : b),
	'-': (a, b) => (typeof a !== 'undefined' ? sub(a, b) : -b),
	'*'(a, b) {
		if (typeof a === 'undefined') throw new Error('`*` is not an unary operator');
		return mul(a, b);
	},
	'/'(a, b) {
		if (typeof a === 'undefined') throw new Error('`/` is not an unary operator');
		if (b == 0) return NaN;
		return div(a, b);
	},
	log(a, b) {
		if (typeof a === 'undefined') throw new Error('`log` requires two arguments (use `ln` for base e)');
		if (a <= 0 || b <= 0) return NaN;
		return div(Math.log(a), Math.log(b));
	},
};
const args2Arr = Object.keys(args2);

function factorial(start) {
	let temp = 1;
	let iterations = start;
	while (iterations > 0) temp *= iterations--;
	return temp;
}

const args1 = {
	'°'(x) {
		if (typeof x === 'undefined') throw new Error('`degree` requires one argument');
		return mul(x, div(Math.PI, 2));
	},
	'!'(x) {
		if (typeof x === 'undefined') throw new Error('`fac` requires one argument');
		if (x < 0) return NaN;
		return factorial(x);
	},
	fac(x) {
		if (typeof x === 'undefined') throw new Error('`fac` requires one argument');
		if (x < 0) return NaN;
		return factorial(x);
	},
	sin(x) {
		if (typeof x === 'undefined') throw new Error('`sin` requires one argument');
		if (div(x, Math.PI) === Math.floor(div(x, Math.PI))) return 0;
		return Math.sin(x);
	},
	cos(x) {
		if (typeof x === 'undefined') throw new Error('`cos` requires one argument');
		if (div(add(x, div(Math.PI, 2)), Math.PI) === Math.floor(div(add(x, div(Math.PI, 2)), Math.PI))) return 0;
		return Math.cos(x);
	},
	tan(x) {
		if (typeof x === 'undefined') throw new Error('`tan` requires one argument');
		return Math.tan(x);
	},
	sqrt(x) {
		if (typeof x === 'undefined') throw new Error('`sqrt` requires one argument');
		return Math.sqrt(x);
	},
	exp(x) {
		if (typeof x === 'undefined') throw new Error('`exp` requires one argument');
		return Math.exp(x);
	},
	ln(x) {
		if (typeof x === 'undefined') throw new Error('`ln` requires one argument');
		return Math.log(x);
	},
};
const args1Arr = Object.keys(args1);


module.exports = class MathCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'm', 'calc' ],
			description: 'supports `+`, `-`, `*`, `/`, `^`, `!`, `sin`, `cos`, `tan`, `sqrt`, `exp`, `ln`, `log`, `pi`, `e`',
			args: false,
			usage: '',
			cooldown: 0,
		});
	}

	/**
	 * throws if the input is larger than Number.MAX_SAFE_INTEGER, returns the value otherwise
	 * @param {any} x
	 */
	validateNumber(x) {
		if (x > Number.MAX_SAFE_INTEGER) throw new Error(`(intermediate) result larger than ${this.client.formatNumber(Number.MAX_SAFE_INTEGER)}`);
		return x;
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(message, args, flags, rawArgs) { // eslint-disable-line no-unused-vars
		// remove channel flags from rawArgs
		removeFlagsFromArray(rawArgs);

		// generate input string
		const INPUT = rawArgs.join(' ')
			.replace(/\*\*/g, '^')
			.replace(/:/g, '/') // 5:3 -> 5/3
			.replace(/(?<=\d\s*)(?=[a-z(])/gi, '*') // add implicit '*' between numbers before letters and '('
			.replace(/(?<=\*)x/gi, '') // 5x3 -> 5*3
			.replace(/=\s*$/, ''); // 5*3= -> 5*3

		let parsed;

		// parse
		try {
			parsed = parse(INPUT);
		} catch (error) {
			return message.reply(`ParseError: ${error.message.replace(/^[A-Z]/, match => match.toLowerCase()).replace(/\.$/, '')}, input: '${INPUT}'`);
		}

		const stack = [];

		let output;

		// calculate
		try {
			const pop = () => this.validateNumber(stack.pop());

			for (const c of parsed) {
				if (args2Arr.includes(c)) {
					const temp = pop();
					stack.push(args2[c](pop(), temp));
					continue;
				}

				if (args1Arr.includes(c)) {
					stack.push(args1[c](pop()));
					continue;
				}

				stack.push(c);
			}

			output = pop();
		} catch (error) {
			return message.reply(`CalculationError: ${error.message}, input: '${INPUT}'`);
		}

		const PRETTIFIED_INPUT = INPUT
			.replace(/pi/gi, '\u{03C0}'); // prettify 'pi'

		// logger.debug({ input: PRETTIFIED_INPUT, output })

		return message.reply(`${PRETTIFIED_INPUT} = ${output}`);
	}
};
