import { CronJob } from 'cron';
import { GUILD_ID_BRIDGER, GUILD_ID_ERROR } from '../../../constants/index.js';
import { autocorrect, logger } from '../../../functions/index.js';
import { ModelManager } from './ModelManager.js';


export class HypixelGuildManager extends ModelManager {
	constructor(options) {
		super(options);

		/**
		 * @type {import('discord.js').Collection<string, import('../models/HypixelGuild').HypixelGuild}
		 */
		this.cache;
		/**
		 * @type {import('../models/HypixelGuild').HypixelGuild}
		 */
		this.model;
	}

	static PSEUDO_GUILD_IDS = [ null, GUILD_ID_BRIDGER, GUILD_ID_ERROR ];

	/**
	 * `NameOne`|`NameTwo`|`NameThree`
	 */
	get guildNames() {
		return this.cache.map(({ name }) => `\`${name.replace(/ /g, '')}\``).join('|');
	}

	/**
	 * `-NameOne`|`-NameTwo`|`-NameThree`
	 */
	get guildNamesAsFlags() {
		return this.cache.map(({ name }) => `\`-${name.replace(/ /g, '')}\``).join('|');
	}

	/**
	 * the main guild's hypixelGuild object
	 */
	get mainGuild() {
		return this.cache.get(this.client.config.get('MAIN_GUILD_ID'));
	}

	async loadCache(condition) {
		await super.loadCache(condition);

		this.cache.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
	}

	/**
	 * update all guilds
	 * @param {import('../models/HypixelGuild').UpdateOptions} [options]
	 * @returns {Promise<boolean>} success
	 */
	async update(options = {}) {
		if (this.client.config.get('HYPIXEL_API_ERROR')) return logger.warn('[GUILDS UPDATE]: auto updates disabled');

		try {
			for (const hypixelGuild of this.cache.values()) {
				await hypixelGuild.update(options);
			}

			return true;
		} catch (error) {
			if (!error.name.startsWith('Sequelize')) this.client.config.set('HYPIXEL_API_ERROR', true);
			logger.error('[GUILDS UPDATE]', error);
			return false;
		}
	}

	/**
	 * sweeps the player cache
	 * @param {?string|import('../models/HypixelGuild').HypixelGuild} idOrGuild
	 */
	sweepPlayerCache(idOrGuild) {
		if (idOrGuild) {
			if (HypixelGuildManager.PSEUDO_GUILD_IDS.includes(idOrGuild)) return;

			const hypixelGuild = this.resolve(idOrGuild);

			if (!hypixelGuild) throw new Error(`[SWEEP PLAYER CACHE]: invalid input: ${idOrGuild}`);

			return hypixelGuild.players = null;
		}

		return this.cache.each(hypixelGuild => hypixelGuild.players = null);
	}

	/**
	 * get a hypixel guild by its name, case insensitive and with auto-correction
	 * @param {string} name name of the hypixel guild
	 * @returns {?import('../models/HypixelGuild').HypixelGuild}
	 */
	getByName(name) {
		if (!name) return null;

		const result = autocorrect(name, this.cache, 'name');

		return (result.similarity >= this.client.config.get('AUTOCORRECT_THRESHOLD'))
			? result.value
			: null;
	}

	/**
	 * schedules the CronJob for the daily stats save for each guild
	 */
	scheduleDailyStatsSave() {
		// daily reset
		if (new Date(this.client.config.get('LAST_DAILY_STATS_SAVE_TIME')).getUTCDay() !== new Date().getUTCDay()) this.performDailyStatsSave();

		// each day at 00:00:00
		this.client.schedule('guildDailyStats', new CronJob({
			cronTime: '0 0 0 * * *',
			timeZone: 'GMT',
			onTick: () => this.performDailyStatsSave(),
			start: true,
		}));
	}

	/**
	 * shifts the daily stats array and updates the config
	 */
	performDailyStatsSave() {
		this.client.config.set('LAST_DAILY_STATS_SAVE_TIME', Date.now());

		for (const hypixelGuild of this.cache.values()) hypixelGuild.saveDailyStats();

		logger.info('[GUILD DAILY STATS]: performed daily stats saves');
	}
}
