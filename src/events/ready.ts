import { minutes, retry, safePromiseAll } from '#functions';
import { logger } from '#logger';
import { Event } from '#structures/events/Event';

export default class ReadyEvent extends Event {
	override once = true;

	private async _connectChatBridges() {
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
			this._connectChatBridges(),
			retry(() => this.client.application!.commands.fetch(), minutes(1), minutes(30)),
			retry(() => this.client.permissions.init(), minutes(1), minutes(30)),
		]);

		// log ready
		logger.info(
			{
				cronJobs: this.client.cronJobs.cache.size,
				logChannel: this.client.logHandler.ready,
				chatBridges: this.client.chatBridges.cache.length,
				applicationCommands: this.client.application!.commands.cache.size,
				permissions: Object.fromEntries(
					this.client.permissions.cache.map((permissions, guildId) => [guildId, permissions.size]),
				),
			},
			'[READY]: startup complete',
		);
	}
}
