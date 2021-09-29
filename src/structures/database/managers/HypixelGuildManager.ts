import { CronJob } from 'cron';
import { GUILD_ID_BRIDGER, GUILD_ID_ERROR } from '../../../constants';
import { autocorrect, compareAlphabetically, logger } from '../../../functions';
import { ModelManager } from './ModelManager';
import type { FindOptions } from 'sequelize';
import type { HypixelGuild, UpdateOptions } from '../models/HypixelGuild';


export class HypixelGuildManager extends ModelManager<HypixelGuild> {
	static PSEUDO_GUILD_IDS = [ null, GUILD_ID_BRIDGER, GUILD_ID_ERROR ] as const;

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
		return this.cache.get(this.client.config.get('MAIN_GUILD_ID') as string)!;
	}

	override async loadCache(condition?: FindOptions) {
		await super.loadCache(condition);

		this.cache.sort((a, b) => compareAlphabetically(a.name, b.name));
		return this;
	}

	/**
	 * update all guilds
	 * @param options
	 */
	async updateData(options?: UpdateOptions) {
		if (this.client.config.get('HYPIXEL_API_ERROR')) return logger.warn('[GUILDS UPDATE]: auto updates disabled');

		try {
			for (const hypixelGuild of this.cache.values()) {
				await hypixelGuild.updateData(options);
			}

			return true;
		} catch (error) {
			if (error instanceof Error && !error.name.startsWith('Sequelize')) this.client.config.set('HYPIXEL_API_ERROR', true);
			logger.error('[GUILDS UPDATE]', error);
			return false;
		}
	}

	/**
	 * sweeps the player cache
	 * @param idOrGuild
	 */
	sweepPlayerCache(idOrGuild?: string | HypixelGuild | null) {
		if (idOrGuild) {
			if (HypixelGuildManager.PSEUDO_GUILD_IDS.includes(idOrGuild as any)) return;

			const hypixelGuild = this.resolve(idOrGuild);

			if (!hypixelGuild) throw new Error(`[SWEEP PLAYER CACHE]: invalid input: ${idOrGuild}`);

			return hypixelGuild.players = null;
		}

		this.cache.each(hypixelGuild => hypixelGuild.players = null);
		return this;
	}

	/**
	 * get a hypixel guild by its name, case insensitive and with auto-correction
	 * @param name name of the hypixel guild
	 */
	getByName(name: string) {
		if (!name) return null;

		const { similarity, value } = autocorrect(name, this.cache, 'name');

		return (similarity >= (this.client.config.get('AUTOCORRECT_THRESHOLD') as number))
			? value
			: null;
	}

	/**
	 * schedules the CronJob for the daily stats save for each guild
	 */
	scheduleDailyStatsSave() {
		// daily reset
		if (new Date(this.client.config.get('LAST_DAILY_STATS_SAVE_TIME') as number).getUTCDay() !== new Date().getUTCDay()) this.performDailyStatsSave();

		// each day at 00:00:00
		this.client.schedule('guildDailyStats', new CronJob({
			cronTime: '0 0 0 * * *',
			timeZone: 'GMT',
			onTick: () => this.performDailyStatsSave(),
			start: true,
		}));

		return this;
	}

	/**
	 * shifts the daily stats array and updates the config
	 */
	performDailyStatsSave() {
		this.client.config.set('LAST_DAILY_STATS_SAVE_TIME', Date.now());

		for (const hypixelGuild of this.cache.values()) hypixelGuild.saveDailyStats();

		logger.info('[GUILD DAILY STATS]: performed daily stats saves');

		return this;
	}
}
