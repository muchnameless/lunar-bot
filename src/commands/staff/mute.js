'use strict';

const ms = require('ms');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class MuteCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'mute a guild member from using the ChatBridge',
			args: true,
			usage: '[`ign`|`discord id`|`@mention`]',
			cooldown: 1,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/LunarClient')} client
	 * @param {import('../../structures/database/ConfigHandler')} config
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(client, config, message, args, flags, rawArgs) {
		const { players } = client;
		const player = (message.mentions.users.size
			? players.getByID(message.mentions.users.first().id)
			: players.getByIGN(args[0]))
			?? players.getByID(args[0]);

		if (!player) return message.reply(`no player ${message.mentions.users.size
			? `linked to \`${message.guild
				? message.mentions.members.first().displayName
				: message.mentions.users.first().username
			}\``
			: `with the IGN \`${args[0]}\``
		} found.`);

		args.shift();

		const BAN_DURATION = args.length
			? ms(args[0])
			: null;
		const EXPIRES_AT = BAN_DURATION
			? Date.now() + BAN_DURATION
			: Infinity;

		player.chatBridgeMutedUntil = EXPIRES_AT;
		player.hasDiscordPingPermission = false;
		await player.save();

		message.reply(`discord messages from \`${player.ign}\` won't be passed to the ingame chat ${BAN_DURATION ? 'anymore' : `for ${ms(BAN_DURATION, { long: true })}`}`);
	}
};
