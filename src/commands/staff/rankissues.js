'use strict';

const { MessageEmbed } = require('discord.js');
const { escapeIgn, trim } = require('../../functions/util');


module.exports = {
	// aliases: [ '' ],
	description: 'list ingame guild rank discrepancies',
	cooldown: 0,
	execute: async (message, args, flags) => {
		const { client } = message;
		const { config, hypixelGuilds } = client;
		const embed = new MessageEmbed()
			.setTitle('Rank issues')
			.setColor(config.get('EMBED_BLUE'))
			.setTimestamp();

		for (const [, hypixelGuild] of hypixelGuilds) {
			const belowWeightReq = [];

			for (const [, player] of hypixelGuild.players) {
				const rank = player.guildRank;

				if (!rank?.roleID) continue; // non-requestable rank

				const { totalWeight } = player.getWeight();

				if (totalWeight >= rank.weightReq) continue;

				belowWeightReq.push({
					player,
					totalWeight,
					rank,
				});
			}

			const BELOW_WEIGHT_REQ_AMOUNT = belowWeightReq.length;

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

		message.reply(embed);
	},
};
