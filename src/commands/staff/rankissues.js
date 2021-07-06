'use strict';

const { EMBED_FIELD_MAX_CHARS } = require('../../constants/discord');
const { escapeIgn, trim } = require('../../functions/util');
const SlashCommand = require('../../structures/commands/SlashCommand');
// const logger = require('../../functions/logger');


module.exports = class RankIssuesCommand extends SlashCommand {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'list ingame guild rank discrepancies',
			options: [],
			defaultPermission: true,
			cooldown: 0,
		});
	}

	/**
	 *
	 * @param {import('../../structures/database/models/HypixelGuild')} hypixelGuild
	 * @returns {{ player: import('../../structures/database/models/Player'), totalWeight: number, rank: import('../../structures/database/models/HypixelGuild').GuildRank }[]}
	 */
	static getBelowRankReqs(hypixelGuild) {
		return hypixelGuild.players.array().flatMap((player) => {
			const rank = player.guildRank;

			if (!rank?.roleId) return []; // unkown or non-requestable rank

			const { totalWeight } = player.getWeight();

			if (totalWeight >= rank.weightReq) return [];

			return {
				player,
				totalWeight,
				rank,
			};
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) {
		const embed = this.client.defaultEmbed;

		let issuesAmount = 0;

		for (const hypixelGuild of this.client.hypixelGuilds.cache.values()) {
			const belowWeightReq = RankIssuesCommand.getBelowRankReqs(hypixelGuild);
			const BELOW_WEIGHT_REQ_AMOUNT = belowWeightReq.length;

			issuesAmount += BELOW_WEIGHT_REQ_AMOUNT;

			embed.addFields(
				BELOW_WEIGHT_REQ_AMOUNT
					? {
						name: `${hypixelGuild.name}: (${BELOW_WEIGHT_REQ_AMOUNT})`,
						value: trim(
							belowWeightReq
								.sort((a, b) => a.rank.name.toLowerCase().localeCompare(b.rank.name.toLowerCase()))
								.map(({ player, totalWeight, rank }) => `${escapeIgn(player.ign)}: ${this.client.formatDecimalNumber(totalWeight)}/${this.client.formatDecimalNumber(rank.weightReq)} [${rank.name}]`)
								.join('\n'),
							EMBED_FIELD_MAX_CHARS,
						),
					}
					: {
						name: `${hypixelGuild.name}:`,
						value: 'none',
					},
			);
		}

		embed.setTitle(`Rank Issues${issuesAmount ? ` (${issuesAmount})` : ''}`);

		return interaction.reply({
			embeds: [
				embed,
			],
		});
	}
};
