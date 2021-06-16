'use strict';

const { demote: { regExp: demote } } = require('../../structures/chat_bridge/constants/commandResponses');
const SlashCommand = require('../../structures/commands/SlashCommand');
const logger = require('../../functions/logger');


module.exports = class PurgeRanksCommand extends SlashCommand {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'demote every player who doesn\'t meet the reqs for their current guild rank',
			options: [ SlashCommand.guildOptionBuilder(data.client) ],
			defaultPermission: true,
			cooldown: 60,
		});
	}

	/**
	 * hypixel guilds for which the command is currently running
	 * @type {Set<string>}
	 */
	static running = new Set();

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) {
		const hypixelGuild = this.getHypixelGuild(interaction.options, interaction);

		if (PurgeRanksCommand.running.has(hypixelGuild.guildID)) return interaction.reply(`a purge is already currently running for ${hypixelGuild.name}`);

		try {
			PurgeRanksCommand.running.add(hypixelGuild.guildID);

			interaction.defer();

			const { chatBridge } = hypixelGuild;
			const belowWeightReq = PurgeRanksCommand.getBelowRankReqs(hypixelGuild);
			const BELOW_WEIGHT_REQ_AMOUNT = belowWeightReq.length;

			if (!BELOW_WEIGHT_REQ_AMOUNT) return interaction.reply(`all ${hypixelGuild.playerCount} members from ${hypixelGuild.name} meet their current rank requirements`);

			await interaction.awaitConfirmation(`demote ${BELOW_WEIGHT_REQ_AMOUNT} players from ${hypixelGuild.name}?`);

			let successCounter = 0;

			for (const { totalWeight, player: { ign } } of belowWeightReq) {
				const NEW_RANK = (hypixelGuild.ranks
					.filter(({ weightReq }) => weightReq !== null && totalWeight >= weightReq)
					.sort((a, b) => a.weightReq - b.weightReq)
					.pop()
					?? hypixelGuild.ranks[0])
					?.name;

				if (!NEW_RANK) {
					logger.error(`[PURGE RANKS]: no new rank for ${ign} (${totalWeight}) found`);
					continue;
				}

				try {
					await chatBridge.minecraft.command({
						command: `g setrank ${ign} ${NEW_RANK}`,
						responseRegExp: demote(ign, undefined, NEW_RANK),
						rejectOnTimeout: true,
					});

					++successCounter;
				} catch (error) {
					logger.error('[PURGE RANKS]', error);
				}
			}

			return interaction.reply(`purge complete, demoted ${successCounter} / ${BELOW_WEIGHT_REQ_AMOUNT}`);
		} finally {
			PurgeRanksCommand.running.delete(hypixelGuild.guildID);
		}
	}
};
