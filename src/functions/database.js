'use strict';

const logger = require('./logger');


/**
 * checks wether the model instance is currently muted
 * @param {import('../structures/database/models/Player')|import('../structures/database/models/HypixelGuild')} model
 */
module.exports.mutedCheck = function(model) {
	if (model.mutedTill) {
		// mute hasn't expired
		if (Date.now() < model.mutedTill) return true;

		// mute has expired
		model.mutedTill = 0;
		model.save().catch(logger.error);
	}

	return false;
};
