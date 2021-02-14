'use strict';

const LunarClient = require('../structures/LunarClient');
const logger = require('../functions/logger');


/**
 * error
 * @param {LunarClient} client
 * @param {*} error
 */
module.exports = async (client, error) => logger.error(error);
