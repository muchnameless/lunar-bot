'use strict';

module.exports = {
	description: 'shows the bot\'s current memory usage',
	aliases: [ 'm' ],
	// args: true,
	usage: '',
	cooldown: 0,
	execute: async (message, args, flags) => {
		const used = process.memoryUsage();

		let response = '';

		for (const key in used) {
			response += `${key} ${Math.round(used[key] / 1024 / 1024 * 100) / 100} MB\n`;
		}

		message.reply(response, { code: 'js' });
	},
};
