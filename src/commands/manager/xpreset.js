'use strict';

const { MessageEmbed } = require('discord.js');
const { Player, Sequelize } = require('../../../database/models/index');
const { offsetFlags } = require('../../constants/database');

const offsetToReset = offsetFlags.COMPETITION_START;


module.exports = {
	aliases: [ 'resetxp' ],
	description: 'reset the competition xp gained',
	usage: 'no arguments to reset everyone\n<`IGN`|`@mention`> to reset individual xp gained',
	cooldown: 5,
	execute: async (message, args, flags) => {
		const { players, config } = message.client;

		let result;

		// individual player
		if (args.length) {
			const player = (message.mentions.users.size
				? players.getByID(message.mentions.users.first().id)
				: players.getByIGN(args[0]))
				?? await Player.findOne({
					where: {
						ign: {
							[Sequelize.Op.iLike]: args[0],
						},
					},
				});

			if (!player) return message.reply(`no player ${message.mentions.users.size
				? `linked to \`${message.guild
					? message.mentions.members.first().displayName
					: message.mentions.users.first().username
				}\``
				: `with the IGN \`${args[0]}\``
			} found.`);

			if (!flags.some(flag => [ 'f', 'force' ].includes(flag))) {
				const ANSWER = await message.awaitReply(`reset xp gained from \`${player.ign}\`? Warning, this action cannot be undone.`, 30);

				if (!config.getArray('REPLY_CONFIRMATION').includes(ANSWER?.toLowerCase())) return message.reply('the command has been cancelled.');
			}

			await player.resetXp({ offsetToReset });

			result = `reset xp gained from \`${player.ign}\``;

		// all players
		} else {
			const PLAYER_COUNT = players.size;

			if (!flags.some(flag => [ 'f', 'force' ].includes(flag))) {
				const ANSWER = await message.awaitReply(`reset competition xp gained from all ${PLAYER_COUNT} guild members? Warning, this action cannot be undone.`, 30);

				if (!config.getArray('REPLY_CONFIRMATION').includes(ANSWER?.toLowerCase())) return message.reply('the command has been cancelled.');
			}

			// delete players who left the guild
			await players.sweepDb();

			await Promise.all([
				...players.map(async player => {
					if (player.notes === 'skill api disabled') player.notes = null;
					return player.resetXp({ offsetToReset });
				}),
				config.set('COMPETITION_START_TIME', Date.now()),
			]);

			result = `reset the competition xp gained from all ${PLAYER_COUNT} guild members`;
		}

		// logging
		message.client.log(new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
			.setTitle('XP Tracking')
			.setDescription(`${message.author.tag} | ${message.author} ${result}`)
			.setTimestamp(),
		);

		message.reply(`${result}.`);
	},
};
