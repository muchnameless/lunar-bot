'use strict';

const handleCommandInteraction = require('../functions/handleCommandInteraction');
const handleButtonInteraction = require('../functions/handleButtonInteraction');
// const logger = require('../functions/logger');


/**
 * error
 * @param {import('../structures/LunarClient')} client
 * @param {import('discord.js').Interaction} interaction
 */
module.exports = async (client, interaction) => {
	// commands
	if (interaction.isCommand()) return handleCommandInteraction(interaction);

	// buttons
	if (interaction.isButton()) return handleButtonInteraction(interaction);
};
