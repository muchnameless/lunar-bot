import { safePromiseAll } from '#functions';
import { logger } from '#logger';
import { Event } from '#structures/events/Event';

export default class ReadyEvent extends Event {
	override once = true;

	async connectChatBridges() {
		if (!this.config.get('CHATBRIDGE_ENABLED')) return;

		await this.client.chatBridges.connect();

		// update hypixelGuilds if next scheduled update is over 1 min from now (to sync guild mutes)
		if (this.config.get('PLAYER_DB_UPDATE_ENABLED')) {
			const INTERVAL = this.config.get('DATABASE_UPDATE_INTERVAL');

			if (INTERVAL - (new Date().getMinutes() % INTERVAL) > 1) {
				void this.client.hypixelGuilds.updateData({ syncRanks: false });
			}
		}
	}

	/**
	 * event listener callback
	 */
	override async run() {
		logger.info(`[READY]: logged in as ${this.client.user!.tag}`);

		this.client.db.schedule();

		await safePromiseAll([
			this.client.logHandler.init(),
			this.connectChatBridges(),
			this.client.application!.commands.fetch(),
		]);

		// log ready
		logger.info(
			`[READY]: startup complete. ${this.client.cronJobs.cache.size} CronJobs running. Logging channel available: ${this.client.logHandler.ready}`,
		);
	}
}
