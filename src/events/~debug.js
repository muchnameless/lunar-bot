'use strict';

const LunarClient = require('../structures/LunarClient');
const logger = require('../functions/logger');


/**
 * debug
 * @param {LunarClient} client
 * @param {...any} args
 */
module.exports = async (client, info) => logger.debug(info);
