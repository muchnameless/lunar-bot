'use strict';

const { stripIndents } = require('common-tags');
const { handleLeaderboardCommandMessage, createTotalStatsEmbed } = require('../../functions/commands/leaderboardMessages');
const { skills, cosmeticSkills, slayers, dungeonTypes, dungeonClasses } = require('../../constants/skyblock');
const { XP_OFFSETS_SHORT } = require('../../constants/database');
const Command = require('../../structures/commands/Command');
// const logger = require('../../functions/logger');


module.exports = class TotalCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 't', 'top' ],
			description: 'guild member leaderboard for total skill lvl / slayer xp',
			usage: () => stripIndents`
				<\`type\`> <page \`number\`> <${this.client.hypixelGuilds.guildNames}|\`all\`> <${
					Object.keys(XP_OFFSETS_SHORT)
						.map(offset => `\`${offset}\``)
						.join('|')
				}> <\`purge\` to only show members below reqs>

				currently supported types:
				skill, ${skills.join(', ')}
				${cosmeticSkills.join(', ')}
				slayer, revenant, tarantula, sven, ${slayers.join(', ')}
				dungeon, ${[ ...dungeonTypes, ...dungeonClasses ].join(', ')}
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
		return handleLeaderboardCommandMessage(message, rawArgs, flags, createTotalStatsEmbed);
	}
};
