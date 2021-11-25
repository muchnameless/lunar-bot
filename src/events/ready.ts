import { GuildUtil } from '../util';
import { logger, safePromiseAll } from '../functions';
import { Event } from '../structures/events/Event';
import type { EventContext } from '../structures/events/BaseEvent';

export default class ReadyEvent extends Event {
	constructor(context: EventContext) {
		super(context, {
			once: true,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 */
	override async run() {
		logger.info(`[READY]: logged in as ${this.client.user!.tag}`);

		await this.client.logHandler.init();

		if (this.client.options.fetchAllMembers) {
			await safePromiseAll(this.client.guilds.cache.map((guild) => GuildUtil.fetchAllMembers(guild)));
		}

		this.client.db.schedule();

		// chatBridges
		if (this.config.get('CHATBRIDGE_ENABLED')) {
			await this.client.chatBridges.connect();

			// update hypixelGuilds if next scheduled update is over 1 min from now (to sync guild mutes)
			if (this.config.get('PLAYER_DB_UPDATE_ENABLED')) {
				const INTERVAL = this.config.get('DATABASE_UPDATE_INTERVAL');

				if (INTERVAL - (new Date().getMinutes() % INTERVAL) > 1) {
					this.client.hypixelGuilds.updateData({ syncRanks: false });
				}
			}
		}

		// log ready
		logger.info(
			`[READY]: startup complete. ${this.client.cronJobs.cache.size} CronJobs running. Logging channel available: ${this.client.logHandler.ready}`,
		);
	}
}
