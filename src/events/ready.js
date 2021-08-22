import { GuildUtil } from '../util/index.js';
import { logger } from '../functions/index.js';
import { Event } from '../structures/events/Event.js';


export default class ReadyEvent extends Event {
	constructor(data) {
		super(data, {
			once: true,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 */
	async run() {
		logger.info(`[READY]: logged in as ${this.client.user.tag}`);

		await this.client.logHandler.init();

		if (this.client.options.fetchAllMembers) {
			try {
				const members = await GuildUtil.fetchAllMembers(this.client.lgGuild);
				logger.info(`[READY]: fetched ${members.size} members`);
			} catch (error) {
				logger.error('[READY]', error);
			}
		}

		this.client.db.schedule();

		// set presence again every 1h cause it get's lost sometimes
		setInterval(() => this.client.user.setPresence(this.client.user.presence), 60 * 60_000).unref();

		// chatBridges
		if (this.config.get('CHATBRIDGE_ENABLED')) {
			await this.client.chatBridges.connect();

			// update hypixelGuilds if next scheduled update is over 1 min from now
			if (this.config.get('PLAYER_DB_UPDATE_ENABLED')) {
				const INTERVAL = this.config.get('DATABASE_UPDATE_INTERVAL');
				if (INTERVAL - (new Date().getMinutes() % INTERVAL) > 1) this.client.hypixelGuilds.updateData({ syncRanks: false });
			}
		}

		// log ready
		logger.info(`[READY]: startup complete. ${this.client.cronJobs.size} CronJobs running. Logging channel available: ${this.client.logHandler.ready}`);
	}
}
