'use strict';

const { Formatters } = require('discord.js');
const tc = require('timezonecomplete');
const { timestampToDateMarkdown } = require('../../functions/util');
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

	static FETCHUR_ITEMS = [
		'50 red wool (Wool Weaver near builder merch in hub)',
		'20 yellow stained glass (Wool Weaver near builder merch in hub)',
		'1 compass (4 iron + 1 redstone)',
		'20 mithril',
		'1 firework (1 gunpowder + 1 paper)',
		'cheap coffee (bartender in hub)',
		'door (wooden or iron)',
		'3 rabbit feet',
		'SuperBoom TNT',
		'1 https://youtu.be/9L7Y681bKz8', // @underappreciated '1 pumpkin'
		'1 flint and steel',
		'50 quartz ore (mine with silk touch)',
		'16 enderpearls',
	];

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
				tomorrow.getTime(),
				today.getTime(),
			].filter(time => time >= Date.now()),
		);

		return ctx.reply(`item: ${FetchurCommand.FETCHUR_ITEMS[(date.getUTCDate() - 1) % FetchurCommand.FETCHUR_ITEMS.length]}, changes ${timestampToDateMarkdown(RESET_TIME, Formatters.TimestampStyles.RelativeTime)}`);
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
