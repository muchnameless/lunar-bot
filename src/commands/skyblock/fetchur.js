'use strict';

const ms = require('ms');
const tc = require('timezonecomplete');
const { fetchurItems } = require('../../constants/skyblock');
const Command = require('../../structures/commands/Command');
// const logger = require('../../functions/logger');


module.exports = class FetchurCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'f' ],
			description: 'shows current fetchur item',
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
		const date = new Date();
		const OFFSET = tc.zone('America/New_York').offsetForUtcDate(date) / 60;

		date.setUTCHours(date.getUTCHours() + OFFSET); // EST

		const tomorrow = new Date();
		tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
		tomorrow.setUTCHours(Math.abs(OFFSET), 0, 0, 0);

		const today = new Date();
		today.setUTCHours(Math.abs(OFFSET), 0, 0, 0);

		const RESET_TIME = Math.min(
			...[
				tomorrow.getTime() - Date.now(),
				today.getTime() - Date.now(),
			].filter(time => time >= 0),
		);

		message.reply(`item: ${fetchurItems[(date.getUTCDate() - 1) % fetchurItems.length]}, time left: ${ms(RESET_TIME, { long: true })}`);
	}
};
