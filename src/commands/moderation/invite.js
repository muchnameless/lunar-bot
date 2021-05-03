'use strict';

const { stripIndent } = require('common-tags');
const { invite: { regExp: invite } } = require('../../structures/chat_bridge/constants/commandResponses');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class InviteCommand extends Command {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [],
			description: 'invite someone into the guild',
			args: true,
			usage: () => `[\`IGN\`] <${this.client.hypixelGuilds.guildNamesAsFlags}>`,
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
	async run(message, args, flags, rawArgs) { // eslint-disable-line no-unused-vars
		/**
		 * @type {import('../../structures/database/models/HypixelGuild')}
		 */
		const hypixelGuild = this.client.hypixelGuilds.getFromArray(flags) ?? message.author.player?.guild;

		if (!hypixelGuild) return message.reply('unable to find your guild.');

		const { chatBridge } = hypixelGuild;
		const [ IGN ] = args;

		try {
			const response = await chatBridge.minecraft.command({
				command: `g invite ${IGN}`,
				responseRegExp: invite(IGN),
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
