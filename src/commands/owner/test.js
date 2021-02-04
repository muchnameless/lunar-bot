'use strict';

const { MessageEmbed } = require('discord.js');
const Command = require('../../structures/Command');
const logger = require('../../functions/logger');


module.exports = class MyCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'debug' ],
			description: 'dynamic test function',
			args: false,
			usage: '<test arguments>',
			cooldown: 0,
		});
	}

	async run(client, config, message, args, flags, rawArgs) {
		const { hypixelGuilds } = client;
		const embed = new MessageEmbed()
			.setTitle('Guild Ranks')
			.setColor(config.get('EMBED_BLUE'))
			.setTimestamp();

		for (const hGuild of hypixelGuilds) {
			const [ prio2Rank, prio3Rank ] = hGuild.ranks.filter(rank => rank.roleID);
			const prio2Promotions = [];
			const prio3Promotions = [];

			for (const player of hGuild.players) {
				const { totalWeight: weight } = player.getWeight();

				if (player.guildRankPriority >= 4) { // staff
					const member = await player.discordMember;

					if (!member) continue;


				} else if (player.guildRankPriority === 3) { // champ


				} else if (player.guildRankPriority === 2) { // sent
					if (weight >= prio3Rank.weightReq) {
						prio3Promotions.push({ ign: player.ign, weight });
					}
				} else { // guard
					if (weight >= prio3Rank.weightReq) {
						prio3Promotions.push({ ign: player.ign, weight });
					} else if (weight >= prio2Rank) {
						prio2Promotions.push({ ign: player.ign, weight });
					}
				}
			}
		}
	}
};
