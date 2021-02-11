'use strict';

const logger = require('../functions/logger');


module.exports = async client => {
	logger.warn('[INVALIDATED]: the client became invalidated');
	client.db.closeConnectionAndExit();
};
