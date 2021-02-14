'use strict';

const LunarClient = require('../structures/LunarClient');
const logger = require('../functions/logger');


/**
 * shardError
 * @param {LunarClient} client
 * @param {*} error
 */
module.exports = (client, error) => logger.error('[SHARD ERROR]:', error);
