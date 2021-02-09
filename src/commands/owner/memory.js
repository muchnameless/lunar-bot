'use strict';

const ConfigCollection = require('../../structures/collections/ConfigCollection');
const LunarMessage = require('../../structures/extensions/Message');
const LunarClient = require('../../structures/LunarClient');
const Command = require('../../structures/Command');
const logger = require('../../functions/logger');


module.exports = class MemoryCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'm' ],
			description: 'shows the bot\'s current memory usage',
			args: false,
			usage: '',
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {LunarClient} client
	 * @param {ConfigCollection} config
	 * @param {LunarMessage} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(client, config, message, args, flags, rawArgs) {
		const used = process.memoryUsage();

		let response = '';

		for (const key in used) {
			response += `${key} ${Math.round(used[key] / 1024 / 1024 * 100) / 100} MB\n`;
		}

		message.reply(response, { code: 'js' });
	}
};
