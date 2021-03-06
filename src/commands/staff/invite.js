'use strict';

const { stripIndent } = require('common-tags');
const { HYPIXEL_RANK_REGEX } = require('../../constants/chatBridge');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class InviteCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'invite someone into the guild',
			args: true,
			usage: () => `[\`IGN\`] <${this.client.hypixelGuilds.guildNameFlags}>`,
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
		const [ IGN ] = args;

		try {
			const response = await chatBridge.command({
				command: `g invite ${IGN}`,
				responseRegex: new RegExp([
					`^You invited ${HYPIXEL_RANK_REGEX}${IGN} to your guild\\. They have 5 minutes to accept\\.$`,
					`^You sent an offline invite to ${HYPIXEL_RANK_REGEX}${IGN}! They will have 5 minutes to accept once they come online!$`,
					`^You've already invited ${HYPIXEL_RANK_REGEX}${IGN} to your guild! Wait for them to accept!$`,
					`^${HYPIXEL_RANK_REGEX}${IGN} is already in (?:another|your) guild!$`,
					'^You do not have permission to invite players!$',
					'You cannot invite this player to your guild!', // g invites disabled
					// '', // guild full
				].join('|'), 'i'),
			});

			message.reply(stripIndent`
				\`/g invite ${IGN}\`
				 > ${response}
			`);
		} catch (error) {
			logger.error(error);
			message.reply(`an unknown error occurred while inviting \`${IGN}\` into \`${hypixelGuild.name}\`.`);
		}
	}
};
