'use strict';

const { handleLeaderboardButtonInteraction } = require('./leaderboards');
const { LB_KEY } = require('../constants/redis');
// const logger = require('./logger');


/**
 * @param {import('discord.js').ButtonInteraction} interaction
 */
module.exports = (interaction) => {
	if (interaction.customID.startsWith(LB_KEY)) return handleLeaderboardButtonInteraction(interaction);
};
