'use strict';

const { stripIndents } = require('common-tags');
const { handleLeaderboardCommandMessage, createGainedStatsEmbed } = require('../../functions/commands/leaderboardMessages');
const { skills, cosmeticSkills, slayers, dungeonTypes, dungeonClasses } = require('../../constants/skyblock');
const { XP_OFFSETS_SHORT } = require('../../constants/database');
const Command = require('../../structures/commands/Command');
// const logger = require('../../functions/logger');


module.exports = class LeaderboardCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'lb', 'gained' ],
			description: 'guild member leaderboard for skill / slayer xp gained',
			usage: () => stripIndents`
				<\`type\`> <page \`number\`> <${this.client.hypixelGuilds.guildNames}|\`all\`> <${
					Object.keys(XP_OFFSETS_SHORT)
						.map(offset => `\`${offset}\``)
						.join('|')
				} Δ>

				currently supported types:
				skill, ${skills.join(', ')}
				${cosmeticSkills.join(', ')}
				slayer, revenant, tarantula, sven, ${slayers.join(', ')}
				dungeon, ${[ ...dungeonTypes, ...dungeonClasses ].join(', ')}
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
	async run(message, args, flags, rawArgs) { // eslint-disable-line no-unused-vars
		return handleLeaderboardCommandMessage(message, args, flags, createGainedStatsEmbed);
	}
};
