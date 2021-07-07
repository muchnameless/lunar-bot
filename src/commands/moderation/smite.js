'use strict';

const { Constants } = require('discord.js');
const { mute: { regExp: mute } } = require('../../structures/chat_bridge/constants/commandResponses');
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
					name: 'player',
					type: Constants.ApplicationCommandOptionTypes.STRING,
					description: 'IGN | uuid | discordID | @mention',
					required: true,
				},
				DualCommand.guildOptionBuilder(data.client, false),
				],
				defaultPermission: true,
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
	 * @param {import('../../structures/extensions/CommandInteraction') | import('../../structures/chat_bridge/HypixelMessage')} ctx
	 * @param {import('../../structures/chat_bridge/ChatBridge')} chatBridge
	 */
	async _run(ctx, chatBridge, target) { // eslint-disable-line no-unused-vars
		return chatBridge.minecraft.command({
			command: `g mute ${target} 10m`,
			responseRegExp: mute(target, chatBridge.bot.ign),
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) { // eslint-disable-line no-unused-vars
		const IGN = this.getPlayer(interaction) ?? (DualCommand.checkForce(interaction.options) && interaction.options.get('player').value);

		if (!IGN) return interaction.reply({
			content: `no player with the IGN \`${interaction.options.get('player').value}\` found`,
			ephemeral: true,
		});

		return interaction.reply({
			embeds: [
				this.client.defaultEmbed
					.setTitle(`/g mute ${IGN} 10m`)
					.setDescription(`\`\`\`\n${await this._run(interaction, this.getHypixelGuild(interaction).chatBridge, IGN)}\`\`\``),
			],
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/chat_bridge/HypixelMessage')} message message that triggered the command
	 * @param {string[]} args command arguments
	 */
	async runInGame(message, args) { // eslint-disable-line no-unused-vars
		const player = this.client.players.getByIgn(args[0]);

		if (!player) return message.reply(`\`${args[0]}\` not in the player db`);

		return message.author.send(await this._run(message, message.chatBridge, player.ign));
	}
};
