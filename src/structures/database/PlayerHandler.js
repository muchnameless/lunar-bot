'use strict';

const { MessageEmbed } = require('discord.js');
const { CronJob } = require('cron');
const { MAYOR_CHANGE_INTERVAL } = require('../../constants/skyblock');
const { offsetFlags } = require('../../constants/database');
const { autocorrect, getWeekOfYear } = require('../../functions/util');
const ModelHandler = require('./ModelHandler');
const logger = require('../../functions/logger');


class PlayerHandler extends ModelHandler {
	constructor(options) {
		super(options);

		/**
		 * @type {import('discord.js').Collection<string, import('./models/Player')>}
		 */
		this.cache;
		/**
		 * @type {import('./models/Player')}
		 */
		this.model;
	}

	/**
	 * @returns {string[]}
	 */
	get ignoredAuctions() {
		return this.cache.array().flatMap(player => player.auctionID ?? []);
	}

	async loadCache() {
		await super.loadCache({
			where: {
				// player is in a guild that the bot tracks (guildID !== null)
				guildID: {
					[this.client.db.Sequelize.Op.ne]: null,
				},
			},
		});

		this.sortAlphabetically();
	}

	/**
	 * add a player to the cache and sweep the player's hypixelGuild's player cache
	 * @param {string} key
	 * @param {import('./models/Player')} value
	 */
	set(key, value) {
		this.client.hypixelGuilds.sweepPlayerCache(value.guildID);

		return this.cache.set(key, value);
	}

	/**
	 * delete a player from the cache and sweep the player's hypixelGuild's player cache
	 * @param {string|import('./models/Player')} idOrPlayer
	 */
	delete(idOrPlayer) {
		const player = this.resolve(idOrPlayer);

		if (!player) throw new Error(`[PLAYER HANDLER DELETE]: invalid input: ${idOrPlayer}`);

		this.client.hypixelGuilds.sweepPlayerCache(player.guildID);

		return this.cache.delete(player.minecraftUUID);
	}

	/**
	 * sweep the cache and the hypixelGuild players cache
	 * @param {Function} fn
	 */
	sweep(fn) {
		this.client.hypixelGuilds.sweepPlayerCache();

		return this.cache.sweep(fn);
	}

	/**
	 * clears the cache and the hypixelGuild players cache
	 */
	clear() {
		this.client.hypixelGuilds.sweepPlayerCache();

		return this.cache.clear();
	}

	/**
	 * sort the cache and sweeps the hypixelGuild players cache
	 * @param {Function} compareFunction
	 */
	sort(compareFunction) {
		this.client.hypixelGuilds.sweepPlayerCache();

		return this.cache.sort(compareFunction);
	}

	/**
	 * add a player to the db and db cache
	 * @param {object} options options for the new db entry
	 * @param {boolean} isAddingSingleEntry wether to call sortAlphabetically() and updateXp() after adding the new entry
	 */
	async add(options = {}, isAddingSingleEntry = true) {
		const newPlayer = await super.add(options);

		this.client.hypixelGuilds.sweepPlayerCache(newPlayer.guildID);

		if (isAddingSingleEntry) {
			this.sortAlphabetically();

			newPlayer.update({
				shouldSkipQueue: true,
				reason: `joined ${newPlayer.guild?.name}`,
			});
		}

		return newPlayer;
	}

	/**
	 * deletes all unnecessary db entries
	 */
	async sweepDb() {
		const playersToSweep = await this.model.findAll({
			where: {
				guildID: null,
				paid: false,
			},
		});
		const sweepedIgns = playersToSweep.map(player => player.ign).join(', ');
		const AMOUNT = playersToSweep.length;

		playersToSweep.forEach(player => player.destroy());
		logger.warn(`[SWEEP DB]: removed ${AMOUNT} entr${AMOUNT === 1 ? 'y' : 'ies'} from the player db: ${sweepedIgns}`);

		return AMOUNT;
	}

	/**
	 * sweeps all cached discord members
	 */
	sweepDiscordMemberCache() {
		return this.cache.each(player => player.discordMember = null);
	}

	/**
	 * get a player by their IGN, case insensitive and with auto-correction
	 * @param {string} ign ign of the player
	 * @returns {?import('./models/Player')}
	 */
	getByIGN(ign) {
		if (!ign) return null;

		const result = autocorrect(ign, this.cache, 'ign');

		return (result.similarity >= this.client.config.get('AUTOCORRECT_THRESHOLD'))
			? result.value
			: null;
	}

	/**
	 * get a player by their discord ID
	 * @param {string} id discord id of the player
	 * @returns {?import('./models/Player')}
	 */
	getByID(id) {
		if (!id) return null;
		return this.cache.find(player => player.discordID === id) ?? null;
	}

	/**
	 * sort alphabetically by IGNs
	 */
	sortAlphabetically() {
		this.cache._array = null;
		return this.cache.sort((a, b) => a.ign.toLowerCase().localeCompare(b.ign.toLowerCase()));
	}

	/**
	 * update db entries and linked discord members of all players
	 */
	update(options = {}) {
		return this.cache.each(player => player.update(options).catch(error => logger.error(`[UPDATE XP]: ${error.name}: ${error.message}`)));
	}

	/**
	 * transfers xp of all players
	 * @param {object} options transfer options
	 */
	transferXp(options = {}) {
		return this.cache.each(player => player.transferXp(options).catch(error => logger.error(`[TRANSFER XP]: ${error.name}: ${error.message}`)));
	}

	/**
	 * reset xp of all players
	 * @param {object} options reset options
	 */
	resetXp(options = {}) {
		return this.cache.each(player => player.resetXp(options).catch(error => logger.error(`[RESET XP]: ${error.name}: ${error.message}`)));
	}

	/**
	 * creates cronJobs for all xp resets
	 */
	scheduleXpResets() {
		const { config } = this.client;

		// auto competition starting
		if (config.getBoolean('COMPETITION_SCHEDULED')) {
			if (config.getNumber('COMPETITION_START_TIME') - 10_000 > Date.now()) {
				this.client.schedule('competitionStart', new CronJob({
					cronTime: new Date(config.getNumber('COMPETITION_START_TIME')),
					onTick: () => this.startCompetition(),
					start: true,
				}));
			} else if (!config.getBoolean('COMPETITION_RUNNING')) {
				this.startCompetition();
			}
		}

		// auto competition ending
		if (config.getNumber('COMPETITION_END_TIME') - 10_000 > Date.now()) {
			this.client.schedule('competitionEnd', new CronJob({
				cronTime: new Date(config.getNumber('COMPETITION_END_TIME')),
				onTick: () => this.endCompetition(),
				start: true,
			}));
		} else if (config.getBoolean('COMPETITION_RUNNING')) {
			this.endCompetition();
		}

		// mayor change reset
		const NEXT_MAYOR_TIME = config.getNumber('LAST_MAYOR_XP_RESET_TIME') + MAYOR_CHANGE_INTERVAL;

		if (NEXT_MAYOR_TIME - 10_000 > Date.now()) {
			this.client.schedule('mayorXpReset', new CronJob({
				cronTime: new Date(NEXT_MAYOR_TIME),
				onTick: () => this.performMayorXpReset(),
				start: true,
			}));
		} else {
			this.performMayorXpReset();
		}

		const now = new Date();

		// daily reset
		if (new Date(config.getNumber('LAST_DAILY_XP_RESET_TIME')).getUTCDay() !== now.getUTCDay()) this.performDailyXpReset();

		// each day at 00:00:00
		this.client.schedule('dailyXpReset', new CronJob({
			cronTime: '0 0 0 * * *',
			timeZone: 'GMT',
			onTick: () => this.performDailyXpReset(),
			start: true,
		}));

		// weekly reset
		if (getWeekOfYear(new Date(config.getNumber('LAST_WEEKLY_XP_RESET_TIME'))) !== getWeekOfYear(now)) this.performWeeklyXpReset();

		// each monday at 00:00:00
		this.client.schedule('weeklyXpReset', new CronJob({
			cronTime: '0 0 0 * * MON',
			timeZone: 'GMT',
			onTick: () => this.performWeeklyXpReset(),
			start: true,
		}));

		// monthly reset
		if (new Date(config.getNumber('LAST_MONTHLY_XP_RESET_TIME')).getUTCMonth() !== now.getUTCMonth()) this.performMonthlyXpReset();

		// the first of each month at 00:00:00
		this.client.schedule('monthlyXpReset', new CronJob({
			cronTime: '0 0 0 1 * *',
			timeZone: 'GMT',
			onTick: () => this.performMonthlyXpReset(),
			start: true,
		}));
	}

	/**
	 * resets competitionStart xp, updates the config and logs the event
	 */
	startCompetition() {
		const { config } = this.client;

		this.resetXp({ offsetToReset: offsetFlags.COMPETITION_START });
		config.set('COMPETITION_RUNNING', 'true');
		config.set('COMPETITION_SCHEDULED', 'false');
		this.client.log(new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
			.setTitle('Guild Competition')
			.setDescription('started')
			.setTimestamp(),
		);
	}

	/**
	 * resets competitionEnd xp, updates the config and logs the event
	 */
	endCompetition() {
		const { config } = this.client;

		this.resetXp({ offsetToReset: offsetFlags.COMPETITION_END });
		config.set('COMPETITION_RUNNING', 'false');
		this.client.log(new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
			.setTitle('Guild Competition')
			.setDescription('ended')
			.setTimestamp(),
		);
	}

	/**
	 * resets offsetMayor xp, updates the config and logs the event
	 */
	performMayorXpReset() {
		const { config } = this.client;
		const CURRENT_MAYOR_TIME = config.getNumber('LAST_MAYOR_XP_RESET_TIME') + MAYOR_CHANGE_INTERVAL;

		config.set('LAST_MAYOR_XP_RESET_TIME', CURRENT_MAYOR_TIME);
		this.resetXp({ offsetToReset: offsetFlags.MAYOR });
		this.client.log(new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
			.setTitle('Current Mayor XP Tracking')
			.setDescription(`reset the xp gained from all ${this.size} guild members`)
			.setTimestamp(),
		);

		this.client.schedule('mayorXpReset', new CronJob({
			cronTime: new Date(CURRENT_MAYOR_TIME + MAYOR_CHANGE_INTERVAL),
			onTick: () => this.performMayorXpReset(),
			start: true,
		}));
	}

	/**
	 * shifts the daily xp array, updates the config and logs the event
	 */
	performDailyXpReset() {
		const { config } = this.client;

		config.set('LAST_DAILY_XP_RESET_TIME', Date.now());
		this.resetXp({ offsetToReset: 'day' });
		this.client.log(new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
			.setTitle('Daily XP Tracking')
			.setDescription(`reset the xp gained from all ${this.size} guild members`)
			.setTimestamp(),
		);
	}

	/**
	 * resets offsetWeek xp, updates the config and logs the event
	 */
	performWeeklyXpReset() {
		const { config } = this.client;

		config.set('LAST_WEEKLY_XP_RESET_TIME', Date.now());
		this.resetXp({ offsetToReset: offsetFlags.WEEK });
		this.client.log(new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
			.setTitle('Weekly XP Tracking')
			.setDescription(`reset the xp gained from all ${this.size} guild members`)
			.setTimestamp(),
		);
	}

	/**
	 * resets offsetMonth xp, updates the config and logs the event
	 */
	performMonthlyXpReset() {
		const { config } = this.client;

		config.set('LAST_MONTHLY_XP_RESET_TIME', Date.now());
		this.resetXp({ offsetToReset: offsetFlags.MONTH });
		this.client.log(new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
			.setTitle('Monthly XP Tracking')
			.setDescription(`reset the xp gained from all ${this.size} guild members`)
			.setTimestamp(),
		);
	}
}

module.exports = PlayerHandler;
