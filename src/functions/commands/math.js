'use strict';
const { add, sub, mul, div } = require('sinful-math');
const Lexer = require('lex');
// const logger = require('../logger');

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

							if (precedence > antecedence || (precedence === antecedence && operator.associativity) === 'right') break;

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
	.addRule(/[\s,]/, () => void 0)
	.addRule(/\d+(?:\.\d+)?|\.\d+|[(+\-*/)^]/, lexeme => lexeme)
	.addRule(/sin(?:e|us)?/i, () => 's')
	.addRule(/cos(?:ine|inus)?/i, () => 'c')
	.addRule(/tan(?:gen[st])?/i, () => 't')
	.addRule(/sqrt|squareroot/i, () => 'r')
	.addRule(/exp/i, () => 'e')
	.addRule(/ln/, () => 'n')
	.addRule(/log/, () => 'l')
	.addRule(/pi/i, () => Math.PI)
	.addRule(/e/i, () => Math.E);

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
	's': func,
	'c': func,
	't': func,
	'r': func,
	'e': func,
	'n': func,
	'l': func,
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
	'+': add,
	'-': sub,
	'*': mul,
	'/': (a, b) => (b !== '0' ? div(a, b) : NaN),
	'l': (a, b) => div(Math.log(a), Math.log(b)),
};
const args2Arr = Object.keys(args2);

const args1 = {
	's': Math.sin,
	'c': Math.cos,
	't': Math.tan,
	'r': Math.sqrt,
	'e': Math.exp,
	'n': Math.log,
};
const args1Arr = Object.keys(args1);

/**
 * math command
 * @param {import('../../structures/extensions/Message')|import('../../structures/chat_bridge/HypixelMessage')} message message that triggered the command
 * @param {string} inputString input string
 */
module.exports = async (message, inputString) => {
	const INPUT = inputString
		.replace(/\*\*/g, '^')
		.replace(/:/g, '/'); // 5:3 -> 5/3
	const stack = [];

	parse(INPUT).forEach((c) => {
		if (args2Arr.includes(c)) {
			const b = stack.pop();
			const a = stack.pop();
			return stack.push(args2[c](a, b));
		}

		if (args1Arr.includes(c)) {
			const a = stack.pop();
			return stack.push(args1[c](a));
		}

		stack.push(c);
	});

	const output = stack.pop();
	const PRETTIFIED_INPUT = INPUT
		.replace(/pi/gi, '\u{03C0}');

	// logger.debug({ input, output })

	if (Number.isNaN(Number(output)) || Number.isFinite(Number(output))) return message.reply(`${PRETTIFIED_INPUT} = ${output}`);

	message.reply(`input evaluates to a value larger than ${message.client.formatNumber(Number.MAX_SAFE_INTEGER)}`);
};
