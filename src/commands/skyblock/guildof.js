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
					description: 'IGN | UUID',
					required: true,
				}],
				cooldown: 1,
			},
			{
				aliases: [ 'guild' ],
				args: 1,
				usage: '[`IGN`]',
			},
		);
	}

	/**
	 * execute the command
	 * @param {string} ignOrUuid
	 */
	async _generateReply(ignOrUuid) {
		try {
			const { uuid, ign } = await mojang.ignOrUuid(ignOrUuid);
			const { name, tag, members } = await hypixel.guild.player(uuid);

			if (!name) return `${ign}: no guild`;

			return `${ign}: ${name}${tag ? ` [${tag}]` : ''} ${members.length}/125 members`;
		} catch (error) {
			logger.error('[GUILDOF CMD]', error);

			return `${error}`;
		}
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) {
		interaction.deferReply();

		return await interaction.reply(await this._generateReply(interaction.options.getString('ign', true)));
	}

	/**
	 * execute the command
	 * @param {import('../../structures/chat_bridge/HypixelMessage')} message
	 */
	async runInGame(message) {
		return await message.reply(await this._generateReply(...message.commandData.args));
	}
};
