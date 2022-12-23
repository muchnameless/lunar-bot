import { CronJob } from 'cron';
import { type GuildResolvable, type Snowflake } from 'discord.js';
import { type FindOptions } from 'sequelize';
import { type HypixelGuild, type UpdateOptions } from '../models/HypixelGuild.js';
import { type ModelResolvable, ModelManager } from './ModelManager.js';
import { autocorrect, compareAlphabetically } from '#functions';
import { logger } from '#logger';

export type HypixelGuildResolvable = ModelResolvable<HypixelGuild>;

export class HypixelGuildManager extends ModelManager<HypixelGuild> {
	/**
	 * hypixel guild db data update
	 */
	private _updateDataPromise: Promise<this> | null = null;

	/**
	 * `NameOne`|`NameTwo`|`NameThree`
	 */
	public get guildNames() {
		return this.cache.map(({ name }) => `\`${name.replaceAll(' ', '')}\``).join('|');
	}

	/**
	 * `-NameOne`|`-NameTwo`|`-NameThree`
	 */
	public get guildNamesAsFlags() {
		return this.cache.map(({ name }) => `\`-${name.replaceAll(' ', '')}\``).join('|');
	}

	/**
	 * the main guild's hypixelGuild object
	 */
	public get mainGuild() {
		return this.cache.get(this.client.config.get('MAIN_GUILD_ID'))!;
	}

	/**
	 * linked discord guilds
	 */
	public get uniqueDiscordGuildIds() {
		return [
			...new Set(
				this.client.hypixelGuilds.cache.map(({ discordId }) => discordId).filter((x): x is Snowflake => x !== null),
			),
		];
	}

	public override async loadCache(condition?: FindOptions) {
		await super.loadCache(condition);

		this.cache.sort(({ name: a }, { name: b }) => compareAlphabetically(a, b));
		return this;
	}

	/**
	 * update all guilds
	 *
	 * @param options
	 */
	public async updateData({ syncRanks = true, rejectOnAPIError = true }: UpdateOptions = {}) {
		if (this._updateDataPromise) return this._updateDataPromise;

		try {
			return await (this._updateDataPromise = this.#updateData({ syncRanks, rejectOnAPIError }));
		} finally {
			this._updateDataPromise = null;
		}
	}

	/**
	 * should only ever be called from within updateData
	 *
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
	 *
	 * @param idOrGuild
	 */
	public sweepPlayerCache(idOrGuild?: HypixelGuildResolvable | null) {
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
	 *
	 * @param name - name of the hypixel guild
	 */
	public findByName(name: string) {
		if (!name) return null;

		const { similarity, value } = autocorrect(name, this.cache, 'name');

		return similarity >= this.client.config.get('AUTOCORRECT_THRESHOLD') ? value : null;
	}

	/**
	 * find a hypixel guild by its linked discord guild
	 *
	 * @param discordGuildResolvable
	 */
	public findByDiscordGuild(discordGuildResolvable: GuildResolvable | null) {
		const discordGuildId = this.client.guilds.resolveId(discordGuildResolvable!);

		if (!discordGuildId) return null;

		return this.cache.find(({ discordId }) => discordId === discordGuildId) ?? null;
	}

	/**
	 * register cron jobs
	 */
	public override schedule() {
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
	public performDailyStatsSave() {
		void this.client.config.set('LAST_DAILY_STATS_SAVE_TIME', Date.now());

		for (const hypixelGuild of this.cache.values()) void hypixelGuild.saveDailyStats();

		logger.info('[GUILD DAILY STATS]: performed daily stats saves');

		return this;
	}

	/**
	 * removes mutes from players that have expired. useful since the map can still hold mutes of players who left the guild
	 */
	public removeExpiredMutes() {
		for (const hypixelGuild of this.cache.values()) {
			void hypixelGuild.removeExpiredMutes();
		}
	}

	/**
	 * update discord stat channel names
	 */
	public async updateStatDiscordChannels() {
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
