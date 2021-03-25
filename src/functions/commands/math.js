'use strict';
// const logger = require('../logger');


/**
 * math command
 * @param {import('../../structures/extensions/Message')|import('../../structures/chat_bridge/HypixelMessage')} message message that triggered the command
 * @param {string} inputString input string
 */
module.exports = async (message, inputString) => {
	if (/[a-z]/i.test(inputString)) return message.reply(`invalid input: \`${inputString}\``);

	const INPUT = inputString
		.replace(/\^/g, '**') // 5^3 -> Math.pow(5, 3)
		.replace(/:/g, '/') // 5:3 -> 5/3
		.replace(/[^\d+\-*/%.()]/g, '');
	const OUTPUT = eval(INPUT);

	if (Number.isNaN(Number(OUTPUT)) || Number.isFinite(Number(OUTPUT))) return message.reply(`${INPUT} = ${OUTPUT}`);

	message.reply(`input evaluates to a value larger than ${message.client.formatNumber(Number.MAX_SAFE_INTEGER)}`);
};
