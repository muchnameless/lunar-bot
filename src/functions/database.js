'use strict';
const logger = require('./logger');


/**
 * checks wether the caller is currently muted
 */
module.exports.mutedCheck = function() {
	if (this.chatBridgeMutedUntil) {
		// mute hasn't expired
		if (Date.now() < this.chatBridgeMutedUntil) return true;

		// mute has expired
		this.chatBridgeMutedUntil = 0;
		this.save().catch(logger.error);
	}

	return false;
};
