'use strict';

const LunarClient = require('../structures/LunarClient');
const logger = require('../functions/logger');


/**
 * warn
 * @param {LunarClient} client
 * @param {*} warning
 */
module.exports = (client, warning) => logger.warn(warning);
