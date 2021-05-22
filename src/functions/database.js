'use strict';

const logger = require('./logger');


/**
 * checks wether the model instance is currently muted
 * @param {import('sequelize').Model} model
 */
module.exports.mutedCheck = function(model) {
	if (model.mutedUntil) {
		// mute hasn't expired
		if (Date.now() < model.mutedUntil) return true;

		// mute has expired
		model.mutedUntil = 0;
		model.save().catch(logger.error);
	}

	return false;
};
