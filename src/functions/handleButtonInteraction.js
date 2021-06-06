'use strict';

const logger = require('./logger');


/**
 * @param {import('discord.js').MessageComponentInteraction} interaction
 */
module.exports = (interaction) => {
	logger.debug(interaction);
	interaction.deferUpdate();
};
