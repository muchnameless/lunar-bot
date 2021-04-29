'use strict';

const { MessageEmbed } = require('discord.js');
const { offsetFlags } = require('../../constants/database');
const { safePromiseAll } = require('../../functions/util');
const Command = require('../../structures/commands/Command');
// const logger = require('../../functions/logger');


module.exports = class XpResetCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'resetxp' ],
			description: 'reset the competition xp gained',
			usage: 'no arguments to reset everyone\n<`IGN`|`@mention`> to reset individual xp gained',
			cooldown: 5,
		});
	}

	static OFFSET_TO_RESET = offsetFlags.COMPETITION_START;

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(message, args, flags, rawArgs) { // eslint-disable-line no-unused-vars
		const { players, db: { Sequelize: { Op } } } = this.client;

		let result;

		// individual player
		if (args.length) {
			/** @type {import('../../structures/database/models/Player')} */
			const player = (message.mentions.users.size
				? message.mentions.users.first().player
				: players.getByIGN(args[0]))
				?? await players.model.findOne({
					where: {
						guildID: null,
						ign: { [Op.iLike]: `%${args[0]}%` },
					},
				});

			if (!player) return message.reply(`no player ${message.mentions.users.size
				? `linked to \`${message.guild
					? message.mentions.members.first().displayName
					: message.mentions.users.first().username
				}\``
				: `with the IGN \`${args[0]}\``
			} found.`);

			if (!this.force(flags)) {
				const ANSWER = await message.awaitReply(`reset xp gained from \`${player.ign}\`?`, 30);

				if (!this.config.getArray('REPLY_CONFIRMATION').includes(ANSWER?.toLowerCase())) return message.reply('the command has been cancelled.');
			}

			await player.resetXp({ offsetToReset: XpResetCommand.OFFSET_TO_RESET });

			result = `reset xp gained from \`${player.ign}\``;

		// all players
		} else {
			const PLAYER_COUNT = players.size;

			if (!this.force(flags)) {
				const ANSWER = await message.awaitReply(`reset competition xp gained from all ${PLAYER_COUNT} guild members?`, 30);

				if (!this.config.getArray('REPLY_CONFIRMATION').includes(ANSWER?.toLowerCase())) return message.reply('the command has been cancelled.');
			}

			// delete players who left the guild
			await players.sweepDb();

			await safePromiseAll([
				...players.cache.map(async (player) => {
					if (player.notes === 'skill api disabled') player.notes = null;
					return player.resetXp({ offsetToReset: XpResetCommand.OFFSET_TO_RESET });
				}),
				this.config.set('COMPETITION_START_TIME', Date.now()),
			]);

			result = `reset the competition xp gained from all ${PLAYER_COUNT} guild members`;
		}

		// logging
		this.client.log(new MessageEmbed()
			.setColor(this.config.get('EMBED_BLUE'))
			.setTitle('XP Tracking')
			.setDescription(`${message.author.tag} | ${message.author} ${result}`)
			.setTimestamp(),
		);

		message.reply(`${result}.`);
	}
};
