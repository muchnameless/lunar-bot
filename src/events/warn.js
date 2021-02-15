'use strict';

const logger = require('../functions/logger');


/**
 * warn
 * @param {import('../structures/LunarClient')} client
 * @param {*} warning
 */
module.exports = (client, warning) => logger.warn(warning);
