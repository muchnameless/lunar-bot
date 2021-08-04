'use strict';

// const logger = require('../../../functions/logger');


/**
 * @param {import('../ChatBridge')} chatBridge
 */
module.exports = async (chatBridge) => {
	chatBridge.emit('ready');
};
