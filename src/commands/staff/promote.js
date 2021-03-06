'use strict';

const { stripIndent } = require('common-tags');
const { HYPIXEL_RANK_REGEX } = require('../../constants/chatBridge');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class PromoteCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'promote a guild member',
			args: true,
			usage: '[`ign`|`discord id`|`@mention`]',
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
		/**
		 * @type {import('../../structures/database/models/HypixelGuild')}
		 */
		const hypixelGuild = this.client.hypixelGuilds.getFromArray(args) ?? message.author.player?.guild;

		if (!hypixelGuild) return message.reply('unable to find your guild.');

		const chatBridge = hypixelGuild.chatBridge;

		const IGN = message.mentions.users.size
			? message.messages.users.first().player?.ign
			: this.client.players.getByIGN(args[0])?.ign ?? this.client.players.getByID(args[0])?.ign ?? args[0];

		try {
			const response = await chatBridge.command({
				command: `g promote ${IGN}`,
				responseRegex: new RegExp([
					`^${HYPIXEL_RANK_REGEX}${IGN} was promoted from [a-z]+ to [a-z]+$`,
					`^${HYPIXEL_RANK_REGEX}${IGN} is already the highest rank`,
					`^${HYPIXEL_RANK_REGEX}${IGN} is the guild master so can't be promoted anymore!`,
					'^You can only promote up to your own rank!',
					'^You must be the Guild Master to use that command!',
					`Can't find a player by the name of '${IGN}'`,
				].join('|'), 'i'),
			});

			message.reply(stripIndent`
				\`/g promote ${IGN}\`
				 > ${response}
			`);
		} catch (error) {
			logger.error(error);
			message.reply(`an unknown error occurred while promoting \`${IGN}\`.`);
		}
	}
};
