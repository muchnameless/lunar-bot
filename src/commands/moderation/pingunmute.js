'use strict';

const { oneLine } = require('common-tags');
const Command = require('../../structures/commands/Command');
// const logger = require('../../functions/logger');


module.exports = class PingUnmuteCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'allow a guild member to @mentioning via the chat bridge',
			args: 1,
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
	async run(message, args, flags, rawArgs) { // eslint-disable-line no-unused-vars
		/** @type {import('../../structures/database/models/Player')} */
		const player = message.mentions.users.size
			? message.mentions.users.first().player
			: (this.client.players.getByID(args[0]) ?? this.client.players.getByIGN(args[0]));

		if (!player) {
			return message.reply(oneLine`${message.mentions.users.size
				? `\`${message.guild
					? message.mentions.members.first().displayName
					: message.mentions.users.first().username}\`
					is`
				: `\`${args[0]}\``
			} not in the player db.`);
		}

		player.hasDiscordPingPermission = true;
		await player.save();

		return message.reply(`\`${player.ign}\` can now ping members via the chat bridge`);
	}
};
