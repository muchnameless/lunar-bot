'use strict';

const logger = require('../functions/logger');


/**
 * debug
 * @param {import('../structures/LunarClient')} client
 * @param {...any} args
 */
module.exports = async (client, info) => logger.debug(info);
