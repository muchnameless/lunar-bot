/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2013 Aadit M Shah
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

type Action = (...lexeme: string[]) => number | string | null;

interface Rule {
	action: Action;
	pattern: RegExp;
}

interface Match {
	action: Action;
	length: number;
	result: RegExpExecArray;
}

export class Lexer {
	private readonly rules: Rule[] = [];

	private remove = 0;

	private index = 0;

	private input = '';

	private reject = true;

	public addRule(pattern: RegExp, action: Action = (x) => x) {
		this.rules.push({
			pattern: new RegExp(pattern.source, `${pattern.flags}gy`),
			action,
		});

		return this;
	}

	public setInput(input: string) {
		this.input = input;
		this.remove = 0;
		this.index = 0;

		return this;
	}

	public lex() {
		this.reject = true;

		while (this.index <= this.input.length) {
			const matches = this._scan().splice(this.remove);
			const { index } = this;

			while (matches.length) {
				if (!this.reject) break;

				const { result, length, action } = matches.shift()!;

				this.index += length;
				this.reject = false;
				++this.remove;

				const token = action(...result);

				if (token !== null) {
					if (length) this.remove = 0;
					return token;
				}
			}

			const { input } = this;

			if (index < input.length) {
				if (this.reject) {
					throw `LexerError: unexpected character \`${input[this.index]}\` at index ${this.index}`;
				}

				if (this.index !== index) this.remove = 0;
				this.reject = true;
			} else if (matches.length) {
				this.reject = true;
			} else {
				break;
			}
		}

		return null;
	}

	private _scan() {
		const matches: Match[] = [];
		const lastIndex = this.index;

		for (const rule of this.rules) {
			rule.pattern.lastIndex = lastIndex;
			const result = rule.pattern.exec(this.input);

			if (result?.index === lastIndex) {
				matches.push({
					result,
					length: result[0]!.length,
					action: rule.action,
				});
			}
		}

		return matches.sort(({ length: a }, { length: b }) => b - a);
	}
}
