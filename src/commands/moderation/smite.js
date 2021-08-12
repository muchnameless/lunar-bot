'use strict';

const { Constants } = require('discord.js');
const InteractionUtil = require('../../util/InteractionUtil');
const DualCommand = require('../../structures/commands/DualCommand');
// const logger = require('../../functions/logger');


module.exports = class SmiteCommand extends DualCommand {
	constructor(data) {
		super(
			data,
			{
				aliases: [],
				description: 'guild mute for 10 minutes',
				options: [{
					name: 'target',
					type: Constants.ApplicationCommandOptionTypes.STRING,
					description: 'IGN | UUID | discord ID | @mention | \'guild\' | \'everyone\'',
					required: true,
				},
				DualCommand.guildOptionBuilder(data.client, false),
				],
				cooldown: 0,
			},
			{
				aliases: [],
				args: 1,
				usage: '[`IGN`]',
			},
		);
	}

	/**
	 * execute the command
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async run(interaction) {
		const errorReply = await this.client.commands.get('guild').runMute(interaction, {
			targetInput: interaction.options.getString('target', true).toLowerCase(),
			duration: 10 * 60_000,
		});

		if (Reflect.has(errorReply ?? {}, 'ephemeral')) return await this.reply(interaction, {
			...errorReply,
			ephemeral: interaction.options.get('visibility') === null
				? InteractionUtil.CACHE.get(interaction).useEphemeral || errorReply.ephemeral
				: InteractionUtil.CACHE.get(interaction).useEphemeral,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/chat_bridge/HypixelMessage')} message
	 */
	async runInGame(message) {
		return await message.author.send(await this.client.commands.get('guild').runMute(message, {
			targetInput: message.commandData.args[0],
			duration: 10 * 60_000,
			hypixelGuildInput: message.chatBridge.hypixelGuild,
		}));
	}
};
