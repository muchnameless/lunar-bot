'use strict';

const logger = require('../functions/logger');


/**
 * error
 * @param {import('../structures/LunarClient')} client
 * @param {*} error
 */
module.exports = async (client, error) => logger.error(error);
