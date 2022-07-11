import { logger } from '#logger';
import { Event } from '#structures/events/Event';

export default class ReadyEvent extends Event {
	override once = true;

	/**
	 * event listener callback
	 */
	override async run() {
		logger.info(`[READY]: logged in as ${this.client.user!.tag}`);

		await this.client.logHandler.init();

		this.client.db.schedule();

		// chatBridges
		if (this.config.get('CHATBRIDGE_ENABLED')) {
			await this.client.chatBridges.connect();

			// update hypixelGuilds if next scheduled update is over 1 min from now (to sync guild mutes)
			if (this.config.get('PLAYER_DB_UPDATE_ENABLED')) {
				const INTERVAL = this.config.get('DATABASE_UPDATE_INTERVAL');

				if (INTERVAL - (new Date().getMinutes() % INTERVAL) > 1) {
					void this.client.hypixelGuilds.updateData({ syncRanks: false });
				}
			}
		}

		// log ready
		logger.info(
			`[READY]: startup complete. ${this.client.cronJobs.cache.size} CronJobs running. Logging channel available: ${this.client.logHandler.ready}`,
		);
	}
}
