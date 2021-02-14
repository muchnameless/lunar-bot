'use strict';

const commandHandler = require('../functions/commandHandler');
const LunarMessage = require('../structures/extensions/Message');
const LunarClient = require('../structures/LunarClient');
const logger = require('../functions/logger');


/**
 * message
 * @param {LunarClient} client
 * @param {LunarMessage} message
 */
module.exports = async (client, message) => commandHandler(client, message);
