'use strict';

const { stripIndent } = require('common-tags');
const { demote: { regExp: demote } } = require('../../structures/chat_bridge/constants/commandResponses');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class DemoteCommand extends Command {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [],
			description: 'demote a guild member',
			args: true,
			usage: '[`ign`|`discord id`|`@mention`] <`-f`|`--force` to disable IGN autocorrection>',
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
		const hypixelGuild = this.client.hypixelGuilds.getFromArray(args) ?? message.author.player?.guild;

		if (!hypixelGuild) return message.reply('unable to find your guild.');

		const { chatBridge } = hypixelGuild;
		const IGN = message.mentions.users.size
			? message.messages.users.first().player?.ign
			: (this.force(flags)
				? args[0]
				: (this.client.players.getByID(args[0])?.ign ?? this.client.players.getByIGN(args[0])?.ign ?? args[0])
			);

		try {
			const response = await chatBridge.minecraft.command({
				command: `g demote ${IGN}`,
				responseRegExp: demote(IGN),
			});

			message.reply(stripIndent`
				\`/g demote ${IGN}\`
				 > ${response}
			`);
		} catch (error) {
			logger.error(error);
			message.reply(`an unknown error occurred while demoting \`${IGN}\`.`);
		}
	}
};
