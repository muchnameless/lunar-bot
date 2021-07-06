'use strict';

const { Constants } = require('discord.js');
const { stripIndents } = require('common-tags');
const DualCommand = require('../../structures/commands/DualCommand');
// const logger = require('../../functions/logger');


module.exports = class RankCommand extends DualCommand {
	constructor(data) {
		super(
			data,
			{
				aliases: [],
				description: 'request a guild rank or list all requestable ranks',
				options: [{
					name: 'rank',
					type: Constants.ApplicationCommandOptionTypes.STRING,
					description: 'rank name',
					required: false,
				}],
				defaultPermission: true,
				cooldown: 1,
			},
			{
				aliases: [ 'request' ],
				args: false,
				usage: '<`rank name` to request>',
			},
		);
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction') | import('../../structures/chat_bridge/HypixelMessage')} ctx
	 * @param {boolean} showAll
	 * @param {import('../../structures/database/models/HypixelGuild')} hypixelGuild
	 */
	async _run(ctx, hypixelGuild, rank) {
		if (rank) return hypixelGuild.handleRankRequestMessage(ctx, rank);

		return ctx.reply(stripIndents`
			Requestable guild ranks: (\`${this.config.get('PREFIX')}${this.name} [rank name]\`)
			${hypixelGuild.ranks
				.filter(({ roleId }) => roleId)
				.map(({ name, weightReq }) => ` • ${name}: ${this.client.formatNumber(weightReq)} weight`)
				.join('\n')}
		`);
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) {
		return this._run(
			interaction,
			interaction.user.player?.guild ?? this.client.hypixelGuilds.mainGuild,
			interaction.options.get('rank')?.value,
		);
	}

	/**
	 * execute the command
	 * @param {import('../../structures/chat_bridge/HypixelMessage')} message message that triggered the command
	 * @param {string[]} args command arguments
	 */
	async runInGame(message, args) { // eslint-disable-line no-unused-vars
		return this._run(
			message,
			message.chatBridge.guild,
			args[0],
		);
	}
};
