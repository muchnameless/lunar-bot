'use strict';

const { MessageEmbed } = require('discord.js');
const { setRank: { regExp: setRank } } = require('../../structures/chat_bridge/constants/commandResponses');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class SetRankCommand extends Command {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [ 'guildsetrank' ],
			description: 'set a rank of a guild member',
			args: 2,
			usage: () => `[\`IGN\`|\`discord id\`|\`@mention\`] [\`rank\` name] <\`-f\`|\`--force\` to disable IGN autocorrection> <${this.client.hypixelGuilds.guildNamesAsFlags}>`,
			cooldown: 0,
		});
	}

	/**
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @returns {string}
	 */
	getIGN(message, args, flags) {
		return message.mentions.users.size
			? message.messages.users.first().player?.ign
			: (this.force(flags)
				? args[0]
				: (this.client.players.getByID(args[0])?.ign ?? this.client.players.getByIGN(args[0])?.ign ?? args[0])
			);
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} flags command flags
	 * @param {string} command
	 * @param {RegExp} responseRegExp
	 * @param {import('../../structures/database/models/HypixelGuild')} hypixelGuildInput
	 */
	async _run(message, flags, command, responseRegExp, hypixelGuildInput) {
		/**
		 * @type {import('../../structures/database/models/HypixelGuild')}
		 */
		const hypixelGuild = hypixelGuildInput ?? this.client.hypixelGuilds.getFromArray(flags) ?? message.author.player?.guild;

		if (!hypixelGuild) return message.reply('unable to find your guild.');

		const { chatBridge } = hypixelGuild;

		try {
			const response = await chatBridge.minecraft.command({
				command,
				responseRegExp,
			});

			return message.reply(new MessageEmbed()
				.setColor(this.config.get('EMBED_BLUE'))
				.setTitle(`/${command}`)
				.setDescription(`\`\`\`\n${response}\`\`\``)
				.setTimestamp(),
			);
		} catch (error) {
			logger.error(`[MODERATION]: '${command}'`, error);
			message.reply(`an unknown error occurred while executing \`${command}\`.`);
		}
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(message, args, flags, rawArgs) { // eslint-disable-line no-unused-vars
		const IGN = this.getIGN(message, args, flags);

		return this._run(message, flags, `g setrank ${IGN} ${args[1]}`, setRank(IGN, undefined, args[1]));
	}
};
