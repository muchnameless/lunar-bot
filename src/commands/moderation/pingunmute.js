'use strict';

const { Constants } = require('discord.js');
const PingMute = require('./pingmute');
const logger = require('../../functions/logger');


module.exports = class PingUnmuteCommand extends PingMute {
	constructor(data) {
		super(
			data,
			{
				aliases: [],
				description: 'allow a guild member to @mention via the chat bridge',
				options: [{
					name: 'player',
					type: Constants.ApplicationCommandOptionTypes.STRING,
					description: 'IGN | UUID | discord ID | @mention',
					required: true,
				}],
				defaultPermission: true,
				cooldown: 0,
			},
		);
	}

	/**
	 * @param {import('../../structures/database/models/Player')} player
	 */
	async _generateReply(player) {
		try {
			player.hasDiscordPingPermission = true;
			await player.save();

			return `\`${player}\` can now ping members via the chat bridge`;
		} catch (error) {
			logger.error(error);
			return `an error occurred while trying to give \`${player}\` ping permissions`;
		}
	}
};
