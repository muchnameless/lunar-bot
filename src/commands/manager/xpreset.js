'use strict';

const { Constants } = require('discord.js');
const { offsetFlags } = require('../../constants/database');
const { safePromiseAll } = require('../../functions/util');
const SlashCommand = require('../../structures/commands/SlashCommand');
// const logger = require('../../functions/logger');


module.exports = class XpResetCommand extends SlashCommand {
	/**
	 * @param {import('../../structures/commands/SlashCommand').CommandData} commandData
	 */
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'reset the competition xp gained',
			options: [{
				name: 'player',
				type: Constants.ApplicationCommandOptionTypes.STRING,
				description: 'IGN | minecraftUUID | discordID | @mention',
				required: false,
			}],
			defaultPermission: true,
			cooldown: 5,
		});
	}

	static OFFSET_TO_RESET = offsetFlags.COMPETITION_START;

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) {
		const { players, db: { Sequelize: { Op } } } = this.client;

		let result;

		// individual player
		if (interaction.options.has('player')) {
			/** @type {import('../../structures/database/models/Player')} */
			const player = this.getPlayer(interaction.options)
				?? await players.model.findOne({
					where: {
						guildID: null,
						ign: { [Op.iLike]: `%${interaction.options.get('player').value}%` },
					},
				});


			if (!player) return interaction.reply(`\`${interaction.options.get('player').value}\` is not in the player db`);

			const ANSWER = await interaction.awaitReply(`reset xp gained from \`${player.ign}\`?`);

			if (!this.config.getArray('REPLY_CONFIRMATION').includes(ANSWER?.toLowerCase())) return interaction.reply('the command has been cancelled');

			await player.resetXp({ offsetToReset: XpResetCommand.OFFSET_TO_RESET });

			result = `reset xp gained from \`${player.ign}\``;

		// all players
		} else {
			const PLAYER_COUNT = players.size;

			const ANSWER = await interaction.awaitReply(`reset competition xp gained from all ${PLAYER_COUNT} guild members?`);

			if (!this.config.getArray('REPLY_CONFIRMATION').includes(ANSWER?.toLowerCase())) return interaction.reply('the command has been cancelled');

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
		this.client.log(this.client.defaultEmbed
			.setTitle('XP Tracking')
			.setDescription(`${interaction.user.tag} | ${interaction.user} ${result}`),
		);

		interaction.reply(result);
	}
};
