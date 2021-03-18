'use strict';

const { stripIndent } = require('common-tags');
const { stringToMS } = require('../../functions/util');
const { mute: { regExp: mute } } = require('../../structures/chat_bridge/constants/commandResponses');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class MuteCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'mute a single guild member or guild chat both ingame and for the chat bridge',
			args: 2,
			usage: () => `[\`ign\`|\`discord id\`|\`@mention\` for a single member] [\`guild\`|\`everyone\`|${this.client.hypixelGuilds.guildNames} for the guild chat] [\`time\` in ms lib format]`,
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
		const [ TARGET_INPUT, DURATION_INPUT ] = args;

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
				: (this.force(flags) ? TARGET_INPUT : players.getByIGN(TARGET_INPUT) ?? players.getByID(TARGET_INPUT) ?? TARGET_INPUT);

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
		const DURATION = stringToMS(DURATION_INPUT);

		if (Number.isNaN(DURATION)) return message.reply(`\`${DURATION_INPUT}\` is not a valid duration.`);

		const EXPIRES_AT = Date.now() + DURATION;

		if (target instanceof players.model) {
			target.chatBridgeMutedUntil = EXPIRES_AT;
			target.hasDiscordPingPermission = false;
			await target.save();

			if (target.notInGuild) return message.reply(`muted \`${target}\` for \`${DURATION_INPUT}\`.`);
		} else if (target === 'everyone') {
			guild.chatMutedUntil = EXPIRES_AT;
			await guild.save();
		}

		try {
			const response = await chatBridge.command({
				command: `g mute ${target} ${DURATION_INPUT}`,
				responseRegex: mute(target === 'everyone' ? 'the guild chat' : target.toString(), chatBridge.bot.username),
			});

			message.reply(stripIndent`
				\`/g mute ${target} ${DURATION_INPUT}\`
				 > ${response}
			`);
		} catch (error) {
			logger.error(error);
			message.reply(`an unknown error occurred while muting ${target === 'everyone' ? `\`${guild.name}\` guild chat` : `\`${target}\``}.`);
		}
	}
};
