import { setTimeout as sleep } from 'node:timers/promises';
import { minutes, safePromiseAll } from '#functions';
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

	async fetchApplicationCommands(retries = 0): Promise<void> {
		try {
			await this.client.application!.commands.fetch();
		} catch (error) {
			logger.error(error, '[READY]: fetchApplicationCommands');

			await sleep(Math.max(retries * minutes(1), minutes(30)));
			return this.fetchApplicationCommands(retries + 1);
		}
	}

	/**
	 * event listener callback
	 */
	override async run() {
		logger.info(`[READY]: logged in as ${this.client.user!.tag}`);

		this.client.db.schedule();

		await safePromiseAll([this.client.logHandler.init(), this.connectChatBridges(), this.fetchApplicationCommands()]);

		// log ready
		logger.info(
			`[READY]: startup complete. ${this.client.cronJobs.cache.size} CronJobs running. Logging channel available: ${this.client.logHandler.ready}`,
		);
	}
}
