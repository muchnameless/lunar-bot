import { logger } from '.';
import type { Player } from '../structures/database/models/Player';
import type { HypixelGuild } from '../structures/database/models/HypixelGuild';


/**
 * checks wether the model instance is currently muted
 * @param model
 */
export function mutedCheck(model: Player | HypixelGuild) {
	if (model.mutedTill) {
		// mute hasn't expired
		if (Date.now() < model.mutedTill) return true;

		// mute has expired
		model.mutedTill = 0;
		model.save().catch(logger.error);
	}

	return false;
}
