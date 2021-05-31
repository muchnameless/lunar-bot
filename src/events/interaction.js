'use strict';

const handleCommandInteraction = require('../functions/handleCommandInteraction');
// const logger = require('../functions/logger');


/**
 * error
 * @param {import('../structures/LunarClient')} client
 * @param {import('discord.js').Interaction} interaction
 */
module.exports = async (client, interaction) => {
	if (interaction.isCommand()) return handleCommandInteraction(interaction);
};
