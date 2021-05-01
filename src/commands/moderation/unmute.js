'use strict';

const { stripIndent } = require('common-tags');
const { unmute: { regExp: unmute } } = require('../../structures/chat_bridge/constants/commandResponses');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class UnmuteCommand extends Command {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [],
			description: 'unmute a single guild member or guild chat both ingame and for the chat bridge',
			args: true,
			usage: () => `[\`ign\`|\`discord id\`|\`@mention\` for a single member] [\`guild\`|\`everyone\`|${this.client.hypixelGuilds.guildNames} for the guild chat] <\`-f\`|\`--force\` to disable IGN autocorrection>`,
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
		let guild = this.client.hypixelGuilds.getFromArray([ ...flags, ...args ]);

		if (guild || [ 'guild', 'everyone' ].includes(TARGET_INPUT.toLowerCase())) {
			target = 'everyone';
			guild ??= message.author.hypixelGuild;

			if (!guild) return message.reply('unable to find your guild.');
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
				({ guild } = target);

				if (!guild) return message.reply(`unable to find the guild for \`${target.ign}\``);
			} else {
				guild ??= message.author.hypixelGuild;

				if (!guild) return message.reply('unable to find your guild.');
			}
		}

		const { chatBridge } = guild;

		if (target instanceof players.model) {
			target.chatBridgeMutedUntil = 0;
			await target.save();

			if (target.notInGuild) return message.reply(`unmuted \`${target}\`.`);
		} else if (target === 'everyone') {
			guild.chatMutedUntil = 0;
			await guild.save();
		}

		try {
			const response = await chatBridge.command({
				command: `g unmute ${target}`,
				responseRegex: unmute(target === 'everyone' ? 'the guild chat' : target.toString(), chatBridge.bot.ign),
			});

			message.reply(stripIndent`
				\`/g unmute ${target}\`
				 > ${response}
			`);
		} catch (error) {
			logger.error(error);
			message.reply(`an unknown error occurred while unmuting ${target === 'everyone' ? `\`${guild.name}\` guild chat` : `\`${target}\``}.`);
		}
	}
};
