'use strict';

const { addPageReactions, getOffsetFromFlags, createGainedStatsEmbed } = require('../../functions/leaderboardMessages');
const { XP_OFFSETS_SHORT } = require('../../constants/database');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class TracklistCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'gained weight from members below reqs',
			args: false,
			usage: '',
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(message, args, flags, rawArgs) {
		let page;

		for (const arg of args) {
			if (/^\d/.test(arg)) {
				page = parseInt(arg, 10);
				break;
			}
		}

		page ??= Infinity;

		const reply = await message.reply(createGainedStatsEmbed(this.client, {
			userID: message.author.id,
			hypixelGuild: this.client.hypixelGuilds.getFromArray(flags) ?? message.author.hypixelGuild,
			type: 'track',
			offset: getOffsetFromFlags(this.client.config, flags) ?? XP_OFFSETS_SHORT.week,
			shouldShowOnlyBelowReqs: true,
			page: page > 0 ? page : 1,
		}));

		addPageReactions(reply);
	}
};
