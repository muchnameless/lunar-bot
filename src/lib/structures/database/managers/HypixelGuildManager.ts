import { CronJob } from 'cron';
import { logger } from '#logger';
import { autocorrect, compareAlphabetically } from '#functions';
import { ModelManager } from './ModelManager';
import type { ModelResovable } from './ModelManager';
import type { GuildResolvable, Snowflake } from 'discord.js';
import type { FindOptions } from 'sequelize';
import type { HypixelGuild, UpdateOptions } from '../models/HypixelGuild';

export type HypixelGuildResolvable = ModelResovable<HypixelGuild>;

export class HypixelGuildManager extends ModelManager<HypixelGuild> {
	/**
	 * hypixel guild db data update
	 */
	private _updateDataPromise: Promise<this> | null = null;

	/**
	 * `NameOne`|`NameTwo`|`NameThree`
	 */
	get guildNames() {
		return this.cache.map(({ name }) => `\`${name.replaceAll(' ', '')}\``).join('|');
	}

	/**
	 * `-NameOne`|`-NameTwo`|`-NameThree`
	 */
	get guildNamesAsFlags() {
		return this.cache.map(({ name }) => `\`-${name.replaceAll(' ', '')}\``).join('|');
	}

	/**
	 * the main guild's hypixelGuild object
	 */
	get mainGuild() {
		return this.cache.get(this.client.config.get('MAIN_GUILD_ID'))!;
	}

	/**
	 * linked discord guilds
	 */
	get uniqueDiscordGuildIds() {
		return [
			...new Set(this.client.hypixelGuilds.cache.map(({ discordId }) => discordId).filter(Boolean) as Snowflake[]),
		];
	}

	override async loadCache(condition?: FindOptions) {
		await super.loadCache(condition);

		this.cache.sort(({ name: a }, { name: b }) => compareAlphabetically(a, b));
		return this;
	}

	/**
	 * update all guilds
	 * @param options
	 */
	async updateData({ syncRanks = true, rejectOnAPIError = true }: UpdateOptions = {}) {
		if (this._updateDataPromise) return this._updateDataPromise;

		try {
			return await (this._updateDataPromise = this.#updateData({ syncRanks, rejectOnAPIError }));
		} finally {
			this._updateDataPromise = null;
		}
	}
	/**
	 * should only ever be called from within updateData
	 * @internal
	 */
	async #updateData(options: UpdateOptions) {
		try {
			if (this.client.config.get('HYPIXEL_API_ERROR')) {
				logger.warn('[GUILDS UPDATE]: auto updates disabled');
				return this;
			}

			for (const hypixelGuild of this.cache.values()) {
				await hypixelGuild.updateData(options);
			}

			return this;
		} catch (error) {
			if (error instanceof Error && !error.name.startsWith('Sequelize')) {
				void this.client.config.set('HYPIXEL_API_ERROR', true);
			}
			logger.error(error, '[GUILDS UPDATE]');
			return this;
		}
	}

	/**
	 * sweeps the player cache
	 * @param idOrGuild
	 */
	sweepPlayerCache(idOrGuild?: HypixelGuildResolvable | null) {
		if (idOrGuild) {
			const hypixelGuild = this.resolve(idOrGuild);

			if (hypixelGuild) {
				hypixelGuild.players = null;
			}
		} else if (idOrGuild !== null) {
			this.cache.each((hypixelGuild) => (hypixelGuild.players = null));
		}

		return this;
	}

	/**
	 * find a hypixel guild by its name, case insensitive and with auto-correction
	 * @param name name of the hypixel guild
	 */
	findByName(name: string) {
		if (!name) return null;

		const { similarity, value } = autocorrect(name, this.cache, 'name');

		return similarity >= this.client.config.get('AUTOCORRECT_THRESHOLD') ? value : null;
	}

	/**
	 * find a hypixel guild by its linked discord guild
	 * @param discordGuildResolvable
	 */
	findByDiscordGuild(discordGuildResolvable: GuildResolvable | null) {
		const discordGuildId = this.client.guilds.resolveId(discordGuildResolvable!);

		if (!discordGuildId) return null;

		return this.cache.find(({ discordId }) => discordId === discordGuildId) ?? null;
	}

	/**
	 * register cron jobs
	 */
	override schedule() {
		// daily stats save
		if (new Date(this.client.config.get('LAST_DAILY_STATS_SAVE_TIME')).getUTCDay() !== new Date().getUTCDay()) {
			this.performDailyStatsSave();
		}
		// each day at 00:00:00
		this.client.cronJobs.schedule(
			`${this.constructor.name}:saveDailyStats`,
			new CronJob({
				cronTime: '0 0 0 * * *',
				timeZone: 'GMT',
				onTick: () => this.performDailyStatsSave(),
			}),
		);

		// remove expired mutes
		this.client.cronJobs.schedule(
			`${this.constructor.name}:removeExpiredMutes`,
			new CronJob({
				cronTime: '0 0 0 * * *',
				timeZone: 'GMT',
				onTick: () => this.removeExpiredMutes(),
			}),
		);

		// schedule guild stats channel update
		this.client.cronJobs.schedule(
			`${this.constructor.name}:updateStatDiscordChannels`,
			new CronJob({
				cronTime: '0 0 * * * *',
				onTick: () =>
					this.client.config.get('STAT_DISCORD_CHANNELS_UPDATE_ENABLED') && this.updateStatDiscordChannels(),
			}),
		);

		return this;
	}

	/**
	 * shifts the daily stats array and updates the config
	 */
	performDailyStatsSave() {
		void this.client.config.set('LAST_DAILY_STATS_SAVE_TIME', Date.now());

		for (const hypixelGuild of this.cache.values()) void hypixelGuild.saveDailyStats();

		logger.info('[GUILD DAILY STATS]: performed daily stats saves');

		return this;
	}

	/**
	 * removes mutes from players that have expired. useful since the map can still hold mutes of players who left the guild
	 */
	removeExpiredMutes() {
		for (const hypixelGuild of this.cache.values()) {
			void hypixelGuild.removeExpiredMutes();
		}
	}

	/**
	 * update discord stat channel names
	 */
	async updateStatDiscordChannels() {
		try {
			for (const hypixelGuild of this.cache.values()) {
				await hypixelGuild.updateStatDiscordChannels();
			}
		} catch (error) {
			logger.error(error, '[UPDATE STAT DISCORD CHANNELS]');
		}

		return this;
	}
}
