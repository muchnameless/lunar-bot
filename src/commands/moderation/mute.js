'use strict';

const { stringToMS } = require('../../functions/util');
const { mute: { regExp: mute } } = require('../../structures/chat_bridge/constants/commandResponses');
const SetRankCommand = require('./setrank');
// const logger = require('../../functions/logger');


module.exports = class MuteCommand extends SetRankCommand {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [ 'guildmute' ],
			description: 'mute a single guild member or guild chat both ingame and for the chat bridge',
			args: 2,
			usage: () => `[\`IGN\`|\`discord id\`|\`@mention\` for a single member] [\`guild\`|\`everyone\`|${this.client.hypixelGuilds.guildNames} for the guild chat] [\`time\` in ms lib format] <\`-f\`|\`--force\` to disable IGN autocorrection>`,
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
		let hypixelGuild = this.client.hypixelGuilds.getFromArray([ ...flags, ...args ]);

		if (hypixelGuild || [ 'guild', 'everyone' ].includes(TARGET_INPUT.toLowerCase())) {
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

		const DURATION = stringToMS(DURATION_INPUT);

		if (Number.isNaN(DURATION)) return message.reply(`\`${DURATION_INPUT}\` is not a valid duration.`);

		const EXPIRES_AT = Date.now() + DURATION;

		if (target instanceof players.model) {
			target.chatBridgeMutedUntil = EXPIRES_AT;
			await target.save();

			if (target.notInGuild) return message.reply(`muted \`${target}\` for \`${DURATION_INPUT}\`.`);
		} else if (target === 'everyone') {
			hypixelGuild.chatMutedUntil = EXPIRES_AT;
			await hypixelGuild.save();
		}

		return this._run(message, flags, `g mute ${target} ${DURATION_INPUT}`, mute(target === 'everyone' ? 'the guild chat' : target.toString(), hypixelGuild.chatBridge.bot.ign), hypixelGuild);
	}
};
