'use strict';

const { CronJob } = require('cron');
const { GUILD_ID_BRIDGER, GUILD_ID_ERROR } = require('../../../constants/database');
const { autocorrect } = require('../../../functions/util');
const ModelManager = require('./ModelManager');
const logger = require('../../../functions/logger');


class HypixelGuildManager extends ModelManager {
	constructor(options) {
		super(options);

		/**
		 * @type {import('discord.js').Collection<string, import('../models/HypixelGuild')}
		 */
		this.cache;
		/**
		 * @type {import('../models/HypixelGuild')}
		 */
		this.model;
	}

	/**
	 * `NameOne`|`NameTwo`|`NameThree`
	 */
	get guildNames() {
		return this.cache.map(({ name }) => `\`${name.replace(/ /g, '')}\``).join('|');
	}

	/**
	 * the main guild's hypixelGuild object
	 */
	get mainGuild() {
		return this.cache.get(this.client.config.get('MAIN_GUILD_ID'));
	}

	get pseudoGuildIDs() {
		return [ GUILD_ID_BRIDGER, GUILD_ID_ERROR ];
	}

	async loadCache(condition) {
		await super.loadCache(condition);

		this.cache.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
	}

	/**
	 * update all guilds
	 * @returns {Promise<boolean>} success
	 */
	async update() {
		if (this.client.config.getBoolean('HYPIXEL_API_ERROR')) return logger.warn('[GUILDS UPDATE]: auto updates disabled');

		try {
			for (const hypixelGuild of this.cache.values()) {
				await hypixelGuild.update();
			}

			return true;
		} catch (error) {
			if (!error.name.includes('Sequelize')) this.client.config.set('HYPIXEL_API_ERROR', 'true');
			logger.error(`[GUILDS UPDATE]: ${error.name}${error.code ? ` ${error.code}` : ''}: ${error.message}`);
			return false;
		}
	}

	/**
	 * sweeps the player cache
	 * @param {?string|import('../models/HypixelGuild')} idOrGuild
	 */
	sweepPlayerCache(idOrGuild) {
		if (idOrGuild) {
			if (this.pseudoGuildIDs.includes(idOrGuild)) return;

			const hypixelGuild = this.resolve(idOrGuild);

			if (!hypixelGuild) throw new Error(`[SWEEP PLAYER CACHE]: invalid input: ${idOrGuild}`);

			return hypixelGuild.players = null;
		}

		return this.cache.each(hypixelGuild => hypixelGuild.players = null);
	}

	/**
	 * get a hypixel guild by its name, case insensitive and with auto-correction
	 * @param {string} name name of the hypixel guild
	 * @returns {?import('../models/HypixelGuild')}
	 */
	getByName(name) {
		if (!name) return null;

		const result = autocorrect(name, this.cache, 'name');

		return (result.similarity >= this.client.config.get('AUTOCORRECT_THRESHOLD'))
			? result.value
			: null;
	}

	/**
	 * autocorrects all elements to the hypixel guilds names and returns the most likely match or null, or 'false' for the 'all'-flag
	 * @param {string[]} args
	 * @returns {?import('../models/HypixelGuild')|boolean}
	 */
	getFromArray(args) {
		const hypixelGuildInput = args
			.map((arg, index) => ({ index, ...this.autocorrectToGuild(arg) }))
			.sort((a, b) => a.similarity - b.similarity)
			.pop();

		return hypixelGuildInput?.similarity >= this.client.config.get('AUTOCORRECT_THRESHOLD')
			? (() => {
				args.splice(hypixelGuildInput.index, 1);
				return hypixelGuildInput.value;
			})()
			: null;
	}

	/**
	 * autocorrects the input to a hypixel guild name
	 * @param {string} input
	 * @returns {import('../models/HypixelGuild')|boolean}
	 */
	autocorrectToGuild(input) {
		const result = autocorrect(input, [ ...this.cache.values(), { name: 'all' }], 'name');

		if (result.value.name === 'all') return { ...result, value: false };

		return result;
	}

	/**
	 * checks if the message is a bridge message to be forwarded to ingame chat and handle it if true
	 * @param {import('../extensions/Message')} message
	 */
	checkIfChatBridgeMessage(message) {
		return this.cache.find(({ chatBridgeChannelID }) => chatBridgeChannelID === message.channel.id)?.handleChatBridgeMessage(message);
	}

	/**
	 * check if the message is a rank request and handle it if true
	 * @param {import('../extensions/Message')} message
	 */
	async checkIfRankRequestMessage(message) {
		if (message.mentions.users.size) return; // ignore messages with tagged users

		try {
			await this.cache.find(({ rankRequestChannelID }) => rankRequestChannelID === message.channel.id)?.handleRankRequestMessage(message);
		} catch (error) {
			logger.error(`[RANK REQUEST]: ${error}`);
		}
	}

	/**
	 * schedules the CronJob for the daily stats save for each guild
	 */
	scheduleDailyStatsSave() {
		// daily reset
		if (new Date(this.client.config.getNumber('LAST_DAILY_STATS_SAVE_TIME')).getUTCDay() !== new Date().getUTCDay()) this.performDailyStatsSave();

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
		this.cache.forEach(hypixelGuild => hypixelGuild.saveDailyStats());

		logger.debug('[GUILD DAILY STATS]: performed daily stats saves');
	}
}

module.exports = HypixelGuildManager;
