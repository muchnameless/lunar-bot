'use strict';

const handleDiscordMessage = require('../functions/handleDiscordMessage');
// const logger = require('../functions/logger');


/**
 * message
 * @param {import('../structures/LunarClient')} client
 * @param {import('../structures/extensions/Message')} message
 */
module.exports = async (client, message) => handleDiscordMessage(message);
