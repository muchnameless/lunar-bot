import { Events } from 'discord.js';
import { HYPIXEL_UPDATE_INTERVAL } from '#constants';
import { minutes, retry, safePromiseAll } from '#functions';
import { logger } from '#logger';
import { DiscordJSEvent } from '#structures/events/DiscordJSEvent.js';
import { UserUtil } from '#utils';

export default class extends DiscordJSEvent {
	public override readonly name = Events.ClientReady;

	public override readonly once = true;

	private async _connectChatBridges() {
		if (!this.config.get('CHATBRIDGE_ENABLED')) return;

		await this.client.chatBridges.connect();

		// update hypixelGuilds if next scheduled update is over 1 min from now (to sync guild mutes)
		if (
			this.config.get('PLAYER_DB_UPDATE_ENABLED') &&
			HYPIXEL_UPDATE_INTERVAL - (new Date().getMinutes() % HYPIXEL_UPDATE_INTERVAL) > 1
		) {
			void this.client.hypixelGuilds.updateData({ syncRanks: false });
		}
	}

	/**
	 * event listener callback
	 */
	public override async run() {
		logger.info(UserUtil.logInfo(this.client.user), '[READY]: logged in');

		this.client.db.schedule();

		await safePromiseAll([
			this.client.logHandler.init(),
			this._connectChatBridges(),
			retry(() => this.client.application.commands.fetch(), minutes(1), minutes(30)),
			retry(() => this.client.permissions.init(), minutes(1), minutes(30)),
		]);

		// log ready
		logger.info(
			{
				cronJobs: this.client.cronJobs.cache.size,
				logChannel: this.client.logHandler.ready,
				chatBridges: this.client.chatBridges.cache.length,
				applicationCommands: this.client.application.commands.cache.size,
				permissions: Object.fromEntries(
					this.client.permissions.cache.map((permissions, guildId) => [guildId, permissions.size]),
				),
			},
			'[READY]: startup complete',
		);
	}
}
