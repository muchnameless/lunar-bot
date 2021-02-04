'use strict';

const { closeConnectionAndExit } = require('../../database/models/index');
const logger = require('../functions/logger');


module.exports = async client => {
	logger.warn('[INVALIDATED]: the client became invalidated');
	closeConnectionAndExit();
};
