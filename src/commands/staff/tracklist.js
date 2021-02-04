'use strict';

const { addPageReactions, getOffsetFromFlags, getHypixelGuildFromFlags, createGainedStatsEmbed } = require('../../functions/leaderboardMessages');
const { XP_OFFSETS_SHORT } = require('../../constants/database');
const Command = require('../../structures/Command');
const logger = require('../../functions/logger');


module.exports = class TracklistCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'track' ],
			description: 'gained weight from members below reqs',
			args: false,
			usage: '',
			cooldown: 1,
		});
	}

	async run(client, config, message, args, flags, rawArgs) {
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
	}
};
