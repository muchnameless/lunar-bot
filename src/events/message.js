'use strict';

const handleCommandMessage = require('../functions/handleCommandMessage');
// const logger = require('../functions/logger');


/**
 * message
 * @param {import('../structures/LunarClient')} client
 * @param {import('../structures/extensions/Message')} message
 */
module.exports = async (client, message) => handleCommandMessage(message);
