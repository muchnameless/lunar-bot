'use strict';

const { MessageEmbed, Util: { splitMessage } } = require('discord.js');
const { Op } = require('sequelize');
const { CronJob } = require('cron');
const { MAYOR_CHANGE_INTERVAL } = require('../../../constants/skyblock');
const { offsetFlags: { COMPETITION_START, COMPETITION_END, MAYOR, WEEK, MONTH, DAY } } = require('../../../constants/database');
const { EMBED_FIELD_MAX_CHARS, EMBED_MAX_CHARS, EMBED_MAX_FIELDS } = require('../../../constants/discord');
const { autocorrect, getWeekOfYear, compareAlphabetically, upperCaseFirstChar, safePromiseAll } = require('../../../functions/util');
const ModelManager = require('./ModelManager');
const logger = require('../../../functions/logger');


module.exports = class PlayerManager extends ModelManager {
	constructor(options) {
		super(options);

		/**
		 * @type {import('discord.js').Collection<string, import('../models/Player')>}
		 */
		this.cache;
		/**
		 * @type {import('../models/Player')}
		 */
		this.model;
		/**
		 * wether a player db update is currently running
		 * @type {boolean}
		 */
		this._isUpdatingXp = false;
	}

	/**
	 * @returns {string[]}
	 */
	get ignoredAuctions() {
		return this.cache.array().flatMap(player => player.auctionID ?? []);
	}

	/**
	 * get players from all guilds (no bridgers or errors)
	 */
	get inGuild() {
		return this.cache.filter(({ notInGuild }) => !notInGuild);
	}

	async loadCache() {
		await super.loadCache({
			where: {
				// player is in a guild that the bot tracks (guildID !== null)
				guildID: {
					[Op.ne]: null,
				},
			},
		});

		this.sortAlphabetically();
	}

	/**
	 * add a player to the cache and sweep the player's hypixelGuild's player cache
	 * @param {string} key
	 * @param {import('../models/Player')} value
	 */
	set(key, value) {
		this.client.hypixelGuilds.sweepPlayerCache(value.guildID);
		this.cache.set(key, value);

		return this;
	}

	/**
	 * delete a player from the cache and sweep the player's hypixelGuild's player cache
	 * @param {string|import('../models/Player')} idOrPlayer
	 */
	delete(idOrPlayer) {
		/** @type {import('../models/Player')} */
		const player = this.resolve(idOrPlayer);

		if (!player) throw new Error(`[PLAYER HANDLER UNCACHE]: invalid input: ${idOrPlayer}`);

		player.uncache();

		return this;
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
	 * @returns {Promise<import('../models/Player')>}
	 */
	async add(options = {}, isAddingSingleEntry = true) {
		const newPlayer = await super.add(options);

		this.client.hypixelGuilds.sweepPlayerCache(newPlayer.guildID);

		if (isAddingSingleEntry) {
			this.sortAlphabetically();

			newPlayer.update({
				reason: `joined ${newPlayer.guild?.name}`,
			});
		}

		return newPlayer;
	}

	/**
	 * deletes all unnecessary db entries
	 */
	async sweepDb() {
		/** @type {import('../models/Player')[]} */
		const playersToSweep = await this.model.findAll({
			where: {
				guildID: null,
				paid: false,
			},
		});

		await safePromiseAll(playersToSweep.map(async player => player.destroy()));

		const AMOUNT = playersToSweep.length;

		logger.warn(`[SWEEP DB]: removed ${AMOUNT} entr${AMOUNT === 1 ? 'y' : 'ies'} from the player db: ${playersToSweep.map(({ ign }) => ign).join(', ')}`);

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
	 * @returns {?import('../models/Player')}
	 */
	getByIGN(ign) {
		if (!ign) return null;

		const result = this.autocorrectToPlayer(ign);

		return (result.similarity >= this.client.config.get('AUTOCORRECT_THRESHOLD'))
			? result.value
			: null;
	}

	/**
	 * find a player by their IGN, case sensitive and without auto-correction
	 * @param {string} ignInput ign of the player
	 */
	findByIGN(ignInput) {
		return this.cache.find(({ ign }) => ign === ignInput) ?? null;
	}

	/**
	 * autocorrects the input to a player ign
	 * @param {string} input
	 * @returns {import('../models/Player')}
	 */
	autocorrectToPlayer(input) {
		return autocorrect(input, this.cache, 'ign');
	}

	/**
	 * get a player by their discord ID
	 * @param {string} id discord id of the player
	 * @returns {?import('../models/Player')}
	 */
	getByID(id) {
		if (!id) return null;
		return this.cache.find(({ discordID }) => discordID === id) ?? null;
	}

	/**
	 * sort players alphabetically by IGNs
	 */
	sortAlphabetically() {
		this.cache._array = null;
		this.cache.sort(compareAlphabetically);
		return this;
	}

	/**
	 * update db entries and linked discord members of all players
	 * @param {import('../models/Player').PlayerUpdateOptions} options
	 */
	async update(options = {}) {
		await Promise.all([
			this.updateXp({ shouldOnlyAwaitUpdateXp: true, ...options }),
			this.updateIGN(),
		]);

		return this;
	}

	/**
	 * update Xp for all players
	 * @param {import('../models/Player').PlayerUpdateOptions} options
	 */
	async updateXp(options) {
		if (this._isUpdatingXp) return this;
		this._isUpdatingXp = true;

		try {
			// the hypxiel api encountered an error before
			if (this.client.config.getBoolean('HYPIXEL_SKYBLOCK_API_ERROR')) {
				// reset error every full hour
				if (new Date().getMinutes() >= this.client.config.getNumber('DATABASE_UPDATE_INTERVAL')) {
					logger.warn('[PLAYERS UPDATE]: auto updates disabled');
					return this;
				}

				this.client.config.set('HYPIXEL_SKYBLOCK_API_ERROR', false);
			}

			try {
				for (const player of this.cache.values()) {
					await player.update({ rejectOnAPIError: true, ...options });
				}
			} catch (error) {
				logger.error('[PLAYERS UPDATE XP]', error);
			}

			return this;
		} finally {
			this._isUpdatingXp = false;
		}
	}

	/**
	 * updates all IGNs and logs changes via the webhook
	 */
	async updateIGN() {
		/** @type {Record<string, string>[]} */
		const log = [];

		await Promise.all(this.cache.map(async (player) => {
			const result = await player.updateIgn();
			if (result) {
				log.push({
					guildID: player.guildID,
					ignChange: `${result.oldIgn} -> ${result.newIgn}`,
				});
			}
		}));

		if (!log.length) return this;

		/** @type {[string, string[]][]} */
		const affectedGuilds = Object.fromEntries([ ...new Set(log.map(({ guildID }) => guildID)) ].map(id => [ id, [] ]));

		for (const { guildID, ignChange } of log) {
			affectedGuilds[guildID].push(ignChange);
		}

		/**
		 * @type {MessageEmbed[]}
		 */
		const embeds = [];
		/**
		 * @param {import('../models/HypixelGuild')|string} guild
		 * @param {number} ignChangesAmount
		 */
		const createEmbed = (guild, ignChangesAmount) => {
			const embed = this.client.defaultEmbed
				.setTitle(`${typeof guild !== 'string' ? guild : upperCaseFirstChar(guild)} Player Database: ${ignChangesAmount} change${ignChangesAmount !== 1 ? 's' : ''}`)
				.setDescription(`Number of players: ${typeof guild !== 'string' ? guild.playerCount : this.cache.filter(({ guildID }) => guildID === guild).size}`);

			embeds.push(embed);

			return embed;
		};

		for (const [ guild, ignChanges ] of Object.entries(affectedGuilds)
			.map(([ guildID, data ]) => [ this.client.hypixelGuilds.cache.get(guildID) ?? guildID, data ])
			.sort(([ guildNameA ], [ guildNameB ]) => compareAlphabetically(guildNameA, guildNameB))
		) {
			const logParts = splitMessage(
				`\`\`\`\n${ignChanges.sort(compareAlphabetically).join('\n')}\`\`\``,
				{ maxLength: EMBED_FIELD_MAX_CHARS, char: '\n', prepend: '```\n', append: '```' },
			);

			let embed = createEmbed(guild, ignChanges.length);
			let currentLength = embed.length;

			while (logParts.length) {
				const name = `${'new ign'.padEnd(150, '\xa0')}\u200b`;
				const value = logParts.shift();

				if (currentLength + name.length + value.length <= EMBED_MAX_CHARS && embed.fields.length < EMBED_MAX_FIELDS) {
					embed.addField(name, value);
					currentLength += name.length + value.length;
				} else {
					embed = createEmbed(guild, ignChanges.length);
					embed.addField(name, value);
					currentLength = embed.length;
				}
			}
		}

		this.client.logMany(embeds);

		return this;
	}

	/**
	 * transfers xp of all players
	 * @param {object} options transfer options
	 */
	async transferXp(options = {}) {
		await safePromiseAll(this.cache.map(async player => player.transferXp(options)));
		return this;
	}

	/**
	 * reset xp of all players
	 * @param {object} options reset options
	 */
	async resetXp(options = {}) {
		await safePromiseAll(this.cache.map(async player => player.resetXp(options)));
		return this;
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
	async startCompetition() {
		const { config } = this.client;

		await this.resetXp({ offsetToReset: COMPETITION_START });

		config.set('COMPETITION_RUNNING', 'true');
		config.set('COMPETITION_SCHEDULED', 'false');

		this.client.log(this.client.defaultEmbed
			.setTitle('Guild Competition')
			.setDescription('started'),
		);
	}

	/**
	 * resets competitionEnd xp, updates the config and logs the event
	 */
	async endCompetition() {
		const { config } = this.client;

		await this.resetXp({ offsetToReset: COMPETITION_END });

		config.set('COMPETITION_RUNNING', 'false');

		this.client.log(this.client.defaultEmbed
			.setTitle('Guild Competition')
			.setDescription('ended'),
		);
	}

	/**
	 * resets offsetMayor xp, updates the config and logs the event
	 */
	async performMayorXpReset() {
		const { config } = this.client;
		const CURRENT_MAYOR_TIME = config.getNumber('LAST_MAYOR_XP_RESET_TIME') + MAYOR_CHANGE_INTERVAL;

		await this.resetXp({ offsetToReset: MAYOR });

		config.set('LAST_MAYOR_XP_RESET_TIME', CURRENT_MAYOR_TIME);

		this.client.log(this.client.defaultEmbed
			.setTitle('Current Mayor XP Tracking')
			.setDescription(`reset the xp gained from all ${this.size} guild members`),
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
	async performDailyXpReset() {
		const { config } = this.client;

		await this.resetXp({ offsetToReset: DAY });

		config.set('LAST_DAILY_XP_RESET_TIME', Date.now());

		this.client.log(this.client.defaultEmbed
			.setTitle('Daily XP Tracking')
			.setDescription(`reset the xp gained from all ${this.size} guild members`),
		);

		this.updateMainProfiles();
	}

	/**
	 * resets offsetWeek xp, updates the config and logs the event
	 */
	async performWeeklyXpReset() {
		const { config } = this.client;

		await this.resetXp({ offsetToReset: WEEK });

		config.set('LAST_WEEKLY_XP_RESET_TIME', Date.now());

		this.client.log(this.client.defaultEmbed
			.setTitle('Weekly XP Tracking')
			.setDescription(`reset the xp gained from all ${this.size} guild members`),
		);
	}

	/**
	 * resets offsetMonth xp, updates the config and logs the event
	 */
	async performMonthlyXpReset() {
		const { config } = this.client;

		await this.resetXp({ offsetToReset: MONTH });

		config.set('LAST_MONTHLY_XP_RESET_TIME', Date.now());

		this.client.log(this.client.defaultEmbed
			.setTitle('Monthly XP Tracking')
			.setDescription(`reset the xp gained from all ${this.size} guild members`),
		);
	}

	/**
	 * checks all players if their current main profile is still valid
	 */
	async updateMainProfiles() {
		// the hypxiel api encountered an error before
		if (this.client.config.getBoolean('HYPIXEL_SKYBLOCK_API_ERROR')) {
			// reset error every full hour
			if (new Date().getMinutes() >= this.client.config.getNumber('DATABASE_UPDATE_INTERVAL')) {
				logger.warn('[PLAYERS UPDATE MAIN PROFILE]: API error');
				return this;
			}

			this.client.config.set('HYPIXEL_SKYBLOCK_API_ERROR', false);
		}

		const log = [];

		for (const player of this.cache.values()) {
			if (player.notInGuild) continue;

			try {
				const result = await player.fetchMainProfile();

				if (!result) continue;

				log.push({
					guildID: player.guildID,
					mainProfileUpdate: `-\xa0${player.ign}: ${result.oldProfileName} -> ${result.newProfileName}`,
				});
			} catch (error) {
				logger.error('[UPDATE MAIN PROFILE]', error);

				if (typeof error === 'string') {
					log.push({
						guildID: player.guildID,
						mainProfileUpdate: `-\xa0${player.ign}: ${error.message}`,
					});
				}
			}
		}

		if (!log.length) return this;

		/** @type {[string, string[]][]} */
		const affectedGuilds = Object.fromEntries([ ...new Set(log.map(({ guildID }) => guildID)) ].map(id => [ id, [] ]));

		for (const { guildID, mainProfileUpdate } of log) {
			affectedGuilds[guildID].push(mainProfileUpdate);
		}

		/**
		 * @type {MessageEmbed[]}
		 */
		const embeds = [];
		/**
		 * @param {import('../models/HypixelGuild')|string} guild
		 * @param {number} mainProfileChangesAmount
		 */
		const createEmbed = (guild, mainProfileChangesAmount) => {
			const embed = new MessageEmbed()
				.setColor(this.client.config.get('EMBED_RED'))
				.setTitle(`${typeof guild !== 'string' ? guild : upperCaseFirstChar(guild)} Player Database: ${mainProfileChangesAmount} change${mainProfileChangesAmount !== 1 ? 's' : ''}`)
				.setDescription(`Number of players: ${typeof guild !== 'string' ? guild.playerCount : this.cache.filter(({ guildID }) => guildID === guild).size}`)
				.setTimestamp();

			embeds.push(embed);

			return embed;
		};

		for (const [ guild, mainProfileUpdate ] of Object.entries(affectedGuilds)
			.map(([ guildID, data ]) => [ this.client.hypixelGuilds.cache.get(guildID) ?? guildID, data ])
			.sort(([ guildNameA ], [ guildNameB ]) => compareAlphabetically(guildNameA, guildNameB))
		) {
			const logParts = splitMessage(
				`\`\`\`diff\n${mainProfileUpdate.sort(compareAlphabetically).join('\n')}\`\`\``,
				{ maxLength: EMBED_FIELD_MAX_CHARS, char: '\n', prepend: '```diff\n', append: '```' },
			);

			let embed = createEmbed(guild, mainProfileUpdate.length);
			let currentLength = embed.length;

			while (logParts.length) {
				const name = `${'main profile update'.padEnd(150, '\xa0')}\u200b`;
				const value = logParts.shift();

				if (currentLength + name.length + value.length <= EMBED_MAX_CHARS && embed.fields.length < EMBED_MAX_FIELDS) {
					embed.addField(name, value);
					currentLength += name.length + value.length;
				} else {
					embed = createEmbed(guild, mainProfileUpdate.length);
					embed.addField(name, value);
					currentLength = embed.length;
				}
			}
		}

		this.client.logMany(embeds);

		return this;
	}
};
