'use strict';

const { Constants } = require('discord.js');
const PingMute = require('./pingmute');
// const logger = require('../../functions/logger');


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
	 * execute the command
	 * @param {import('../../structures/database/models/Player')} player
	 */
	async _run(player) {
		player.hasDiscordPingPermission = true;
		await player.save();

		return `\`${player}\` can now ping members via the chat bridge`;
	}
};
