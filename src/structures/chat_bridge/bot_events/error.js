'use strict';

// const logger = require('../../../functions/logger');


/**
 * @param {import('../ChatBridge')} chatBridge
 */
module.exports = (chatBridge, error) => {
	chatBridge.emit('error', error);
};
