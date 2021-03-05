'use strict';

const { stripIndents } = require('common-tags');
const { handleLeaderboardCommandMessage, createGainedStatsEmbed } = require('../../functions/leaderboardMessages');
const { SKILLS, COSMETIC_SKILLS, SLAYERS, DUNGEON_TYPES, DUNGEON_CLASSES } = require('../../constants/skyblock');
const { XP_OFFSETS_SHORT } = require('../../constants/database');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class LeaderboardCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'lb' ],
			description: 'guild member leaderboard for skill / slayer xp gained',
			usage: () => stripIndents`
				<\`type\`> <page \`number\`> <${this.client.hypixelGuilds.guildNames}|\`all\`> <${Object.keys(XP_OFFSETS_SHORT).map(offset => `\`${offset}\``).join('|')} Δ>

				currently supported types:
				skill, ${SKILLS.join(', ')}
				${COSMETIC_SKILLS.join(', ')}
				slayer, revenant, tarantula, sven, ${SLAYERS.join(', ')}
				dungeon, ${[ ...DUNGEON_TYPES, ...DUNGEON_CLASSES ].join(', ')}
				guildxp
				weight
			`,
			cooldown: 1,
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
		return handleLeaderboardCommandMessage(message, args, flags, createGainedStatsEmbed);
	}
};
