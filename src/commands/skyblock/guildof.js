'use strict';

const { Constants } = require('discord.js');
const mojang = require('../../api/mojang');
const hypixel = require('../../api/hypixel');
const DualCommand = require('../../structures/commands/DualCommand');
const logger = require('../../functions/logger');


module.exports = class GuildOfCommand extends DualCommand {
	constructor(data) {
		super(
			data,
			{
				aliases: [],
				description: 'shows a player\'s current hypixel guild',
				options: [{
					name: 'ign',
					type: Constants.ApplicationCommandOptionTypes.STRING,
					description: 'IGN | uuid',
					required: true,
				}],
				defaultPermission: true,
				cooldown: 1,
			},
			{
				aliases: [ 'guild' ],
				args: false,
				usage: '[`IGN`]',
			},
		);
	}

	/**
	 * rounds and toLocaleStrings a number
	 * @param {number} number
	 * @returns {string}
	 */
	formatNumber(number) {
		return this.client.formatDecimalNumber(Math.floor(number * 100) / 100);
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction') | import('../../structures/chat_bridge/HypixelMessage')} ctx
	 * @param {string} [ignOrUuid]
	 */
	async _run(ctx, ignOrUuid) {
		try {
			const { uuid, ign } = await mojang.ignOrUuid(ignOrUuid);
			const { name, tag } = await hypixel.guild.player(uuid);

			return ctx.reply(`${ign}: ${name ?? 'no guild'} ${tag ? `[${tag}]` : ''}`);
		} catch (error) {
			logger.error(`[${this.name.toUpperCase()} CMD]`, error);

			return ctx.reply(`${error}`);
		}
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) {
		interaction.defer();

		return this._run(interaction, interaction.options.get('ign')?.value);
	}

	/**
	 * execute the command
	 * @param {import('../../structures/chat_bridge/HypixelMessage')} message message that triggered the command
	 * @param {string[]} args command arguments
	 */
	async runInGame(message, args) { // eslint-disable-line no-unused-vars
		return this._run(message, ...args);
	}
};
