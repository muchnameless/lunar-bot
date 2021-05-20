'use strict';

const { unmute: { regExp: unmute } } = require('../../structures/chat_bridge/constants/commandResponses');
const SetRankCommand = require('./setrank');
// const logger = require('../../functions/logger');


module.exports = class UnmuteCommand extends SetRankCommand {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [ 'guildunmute' ],
			description: 'unmute a single guild member or guild chat both ingame and for the chat bridge',
			args: true,
			usage: () => `[\`IGN\`|\`discord id\`|\`@mention\` for a single member | \`guild\`|\`everyone\`|${this.client.hypixelGuilds.guildNames} for the guild chat] <${this.collection.constructor.forceFlagsAsFlags} to disable IGN autocorrection>`,
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
		const { players } = this.client;
		const [ TARGET_INPUT ] = args;

		let target;
		/**
		 * @type {import('../../structures/database/models/HypixelGuild')}
		 */
		let hypixelGuild = this.client.hypixelGuilds.getFromArray([ ...flags, ...args ]);

		if ([ 'guild', 'everyone' ].includes(TARGET_INPUT.toLowerCase())) {
			target = 'everyone';
			hypixelGuild ??= message.author.hypixelGuild;

			if (!hypixelGuild) return message.reply('unable to find your guild.');
		} else {
			target = message.mentions.users.size
				? message.mentions.users.first().player
				: (this.force(flags)
					? TARGET_INPUT
					: (players.getByID(TARGET_INPUT) ?? players.getByIGN(TARGET_INPUT) ?? TARGET_INPUT)
				);

			if (!target) return message.reply(`no player ${message.mentions.users.size
				? `linked to \`${message.guild
					? message.mentions.members.first().displayName
					: message.mentions.users.first().username
				}\``
				: `with the IGN \`${TARGET_INPUT}\``
			} found.`);

			if (target instanceof players.model) {
				({ guild: hypixelGuild } = target);

				if (!hypixelGuild) return message.reply(`unable to find the guild for \`${target.ign}\``);
			} else {
				hypixelGuild ??= message.author.hypixelGuild;

				if (!hypixelGuild) return message.reply('unable to find your guild.');
			}
		}

		if (target instanceof players.model) {
			target.chatBridgeMutedUntil = 0;
			await target.save();

			if (target.notInGuild) return message.reply(`unmuted \`${target}\`.`);
		} else if (target === 'everyone') {
			hypixelGuild.chatMutedUntil = 0;
			await hypixelGuild.save();
		}

		return this._run(message, flags, {
			command: `g unmute ${target}`,
			responseRegExp: unmute(target === 'everyone' ? 'the guild chat' : `${target}`, hypixelGuild.chatBridge.bot.ign),
		}, hypixelGuild);
	}
};
