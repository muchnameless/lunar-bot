import { logger } from './index.js';


/**
 * checks wether the model instance is currently muted
 * @param {import('../structures/database/models/Player').Player|import('../structures/database/models/HypixelGuild').HypixelGuild} model
 */
export function mutedCheck(model) {
	if (model.mutedTill) {
		// mute hasn't expired
		if (Date.now() < model.mutedTill) return true;

		// mute has expired
		model.mutedTill = 0;
		model.save().catch(logger.error);
	}

	return false;
}
