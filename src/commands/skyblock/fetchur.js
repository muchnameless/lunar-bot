'use strict';

const ms = require('ms');
const tc = require('timezonecomplete');
const { fetchurItems } = require('../../constants/skyblock');
const DualCommand = require('../../structures/commands/DualCommand');
// const logger = require('../../functions/logger');


module.exports = class FetchurCommand extends DualCommand {
	constructor(data) {
		super(
			data,
			{
				aliases: [],
				description: 'shows the current fetchur item',
				options: [],
				defaultPermission: true,
				cooldown: 0,
			},
			{
				aliases: [ 'f' ],
				args: false,
				usage: '',
			},
		);
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction') | import('../../structures/chat_bridge/HypixelMessage')} ctx
	 */
	async run(ctx) { // eslint-disable-line no-unused-vars
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

		return ctx.reply(`item: ${fetchurItems[(date.getUTCDate() - 1) % fetchurItems.length]}, time left: ${ms(RESET_TIME, { long: true })}`);
	}

	/**
	 * execute the command
	 * @param {import('../../structures/chat_bridge/HypixelMessage')} message message that triggered the command
	 * @param {string[]} args command arguments
	 */
	async runInGame(message, args) { // eslint-disable-line no-unused-vars
		return this.run(message);
	}
};
