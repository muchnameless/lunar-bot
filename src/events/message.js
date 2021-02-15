'use strict';

const commandHandler = require('../functions/commandHandler');
const logger = require('../functions/logger');


/**
 * message
 * @param {import('../structures/LunarClient')} client
 * @param {import('../structures/extensions/Message')} message
 */
module.exports = async (client, message) => commandHandler(client, message);
