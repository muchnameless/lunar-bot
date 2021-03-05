'use strict';

const { stripIndent } = require('common-tags');
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
		const hypixelGuild = this.client.hypixelGuilds.getFromArray(args) ?? message.author.player?.guild;

		if (!hypixelGuild) return message.reply('unable to find your guild.');

		const chatBridge = hypixelGuild.chatBridge;
		const [ ign ] = args;

		try {
			const response = await chatBridge.command({
				command: `g invite ${ign}`,
				responseRegex: /^You invited (?:\[.+?\] )?\w+ to your guild\. They have 5 minutes to accept\.$|^You sent an offline invite to (?:\[.+?\] )?\w+! They will have 5 minutes to accept once they come online!$|^You've already invited (?:\[.+?\] )?\w+ to your guild! Wait for them to accept!$|^(?:\[.+?\] )?\w+ is already in another guild!$|^You do not have permission to invite players!$/,
			});

			message.reply(stripIndent`
				invited \`${ign}\` into \`${hypixelGuild.name}\`
				 > ${response}
			`);
		} catch (error) {
			logger.error(error);
			message.reply(`an unknown error occurred while inviting \`${ign}\` into \`${hypixelGuild.name}\`.`);
		}
	}
};
