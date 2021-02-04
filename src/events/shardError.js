'use strict';

const logger = require('../functions/logger');


module.exports = (client, error) => logger.error('[SHARD ERROR]:', error);
