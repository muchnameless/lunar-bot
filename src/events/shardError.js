'use strict';

const logger = require('../functions/logger');


/**
 * shardError
 * @param {import('../structures/LunarClient')} client
 * @param {*} error
 */
module.exports = (client, error) => logger.error('[SHARD ERROR]:', error);
