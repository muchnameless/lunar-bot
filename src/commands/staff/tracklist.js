'use strict';

const { addPageReactions, getOffsetFromFlags, getHypixelGuildFromFlags, createGainedStatsEmbed } = require('../../functions/leaderboardMessages');
const { XP_OFFSETS_SHORT } = require('../../constants/database');
const ConfigCollection = require('../../structures/collections/ConfigCollection');
const LunarMessage = require('../../structures/extensions/Message');
const LunarClient = require('../../structures/LunarClient');
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

	/**
	 * execute the command
	 * @param {LunarClient} client
	 * @param {ConfigCollection} config
	 * @param {LunarMessage} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
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
