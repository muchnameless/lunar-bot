'use strict';

const { stripIndent } = require('common-tags');
const { demote: { regExp: demote } } = require('../../structures/chat_bridge/constants/commandResponses');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class DemoteCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'demote a guild member',
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
	async run(message, args) {
		/**
		 * @type {import('../../structures/database/models/HypixelGuild')}
		 */
		const hypixelGuild = this.client.hypixelGuilds.getFromArray(args) ?? message.author.player?.guild;

		if (!hypixelGuild) return message.reply('unable to find your guild.');

		const { chatBridge } = hypixelGuild;

		const IGN = message.mentions.users.size
			? message.messages.users.first().player?.ign
			: this.client.players.getByIGN(args[0])?.ign ?? this.client.players.getByID(args[0])?.ign ?? args[0];

		try {
			const response = await chatBridge.command({
				command: `g demote ${IGN}`,
				responseRegex: demote(IGN),
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
