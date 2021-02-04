'use strict';

const { addPageReactions, getOffsetFromFlags, getHypixelGuildFromFlags, createGainedStatsEmbed } = require('../../functions/leaderboardMessages');
const { XP_OFFSETS_SHORT } = require('../../constants/database');


module.exports = {
	aliases: [ 'track' ],
	description: 'gained weight from members below reqs',
	// args: true,
	// usage: '[`discord id`|`@mention`]',
	cooldown: 1,
	execute: async (message, args, flags) => {
		const { client } = message;
		const { config } = client;
		const { id: userID } = message.author;

		let page;

		for (const arg of args) {
			if (/^\d/.test(arg)) {
				page = parseInt(arg, 10);
				break;
			}
		}

		page ??= Infinity;

		const reply = await message.reply(createGainedStatsEmbed(client, {
			userID,
			hypixelGuild: getHypixelGuildFromFlags(client, flags) ?? client.players.getByID(userID)?.guild,
			type: 'track',
			offset: getOffsetFromFlags(config, flags) ?? XP_OFFSETS_SHORT.week,
			shouldShowOnlyBelowReqs: true,
			page: page > 0 ? page : 1,
		}));

		addPageReactions(reply);
	},
};
