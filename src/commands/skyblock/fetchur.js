'use strict';

const { Formatters } = require('discord.js');
const { zone, TimeStruct } = require('timezonecomplete');
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
	 */
	_generateReply() { // eslint-disable-line class-methods-use-this
		const date = new Date();
		const OFFSET = zone('America/New_York').offsetForUtc(TimeStruct.fromDate(date)) / 60;
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

		return `item: ${FetchurCommand.FETCHUR_ITEMS[(date.getUTCDate() - 1) % FetchurCommand.FETCHUR_ITEMS.length]}, changes ${Formatters.time(new Date(RESET_TIME), Formatters.TimestampStyles.RelativeTime)}`;
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) {
		return interaction.reply(this._generateReply());
	}

	/**
	 * execute the command
	 * @param {import('../../structures/chat_bridge/HypixelMessage')} message
	 */
	async runInGame(message) {
		return message.reply(this._generateReply());
	}
};
