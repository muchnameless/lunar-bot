'use strict';

const { stripIndent } = require('common-tags');
const { invite: { regExp: invite } } = require('../../structures/chat_bridge/constants/commandResponses');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class InviteCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'invite someone into the guild',
			args: true,
			usage: () => `[\`IGN\`] <${this.client.hypixelGuilds.guildNames}>`,
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
	async run(message, args) {
		/**
		 * @type {import('../../structures/database/models/HypixelGuild')}
		 */
		const hypixelGuild = this.client.hypixelGuilds.getFromArray(args) ?? message.author.player?.guild;

		if (!hypixelGuild) return message.reply('unable to find your guild.');

		const { chatBridge } = hypixelGuild;
		const [ IGN ] = args;

		try {
			const response = await chatBridge.command({
				command: `g invite ${IGN}`,
				responseRegex: invite(IGN),
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
