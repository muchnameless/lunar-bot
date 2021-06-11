'use strict';

const { EMBED_FIELD_MAX_CHARS } = require('../../constants/discord');
const { escapeIgn, trim } = require('../../functions/util');
const Command = require('../../structures/commands/Command');
// const logger = require('../../functions/logger');


module.exports = class RankIssuesCommand extends Command {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [],
			description: 'list ingame guild rank discrepancies',
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

			if (!rank?.roleID) return []; // unkown or non-requestable rank

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
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 */
	async run(message, args) { // eslint-disable-line no-unused-vars
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

		message.reply({ embeds: [ embed ] });
	}
};
