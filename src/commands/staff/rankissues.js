'use strict';

const { MessageEmbed } = require('discord.js');
const { escapeIgn, trim } = require('../../functions/util');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class RankIssuesCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'list ingame guild rank discrepancies',
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/LunarClient')} client
	 * @param {import('../../structures/database/ConfigHandler')} config
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(client, config, message, args, flags, rawArgs) {
		const embed = new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
			.setTimestamp();

		let issuesAmount = 0;

		for (const hypixelGuild of client.hypixelGuilds.cache.values()) {
			const belowWeightReq = [];

			for (const player of hypixelGuild.players.values()) {
				const rank = player.guildRank;

				if (!rank?.roleID) continue; // unkown or non-requestable rank

				const { totalWeight } = player.getWeight();

				if (totalWeight >= rank.weightReq) continue;

				belowWeightReq.push({
					player,
					totalWeight,
					rank,
				});
			}

			const BELOW_WEIGHT_REQ_AMOUNT = belowWeightReq.length;

			issuesAmount += BELOW_WEIGHT_REQ_AMOUNT;

			embed.addFields(
				BELOW_WEIGHT_REQ_AMOUNT
					? {
						name: `${hypixelGuild.name}: (${BELOW_WEIGHT_REQ_AMOUNT})`,
						value: trim(
							belowWeightReq
								.sort((a, b) => a.rank.name.toLowerCase().localeCompare(b.rank.name.toLowerCase()))
								.map(({ player, totalWeight, rank }) => `${escapeIgn(player.ign)}: ${client.formatDecimalNumber(totalWeight)}/${client.formatDecimalNumber(rank.weightReq)} [${rank.name}]`)
								.join('\n'),
							1024,
						),
					}
					: {
						name: `${hypixelGuild.name}:`,
						value: 'none',
					},
			);
		}

		message.reply(embed
			.setTitle(`Rank Issues${issuesAmount ? ` (${issuesAmount})` : ''}`),
		);
	}
};
