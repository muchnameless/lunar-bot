import { MessageEmbed, Formatters, Util } from 'discord.js';
import { setTimeout as sleep } from 'timers/promises';
import pkg from 'sequelize';
const { Op } = pkg;
import { CronJob } from 'cron';
import { EMBED_FIELD_MAX_CHARS, EMBED_MAX_CHARS, EMBED_MAX_FIELDS, MAYOR_CHANGE_INTERVAL, OFFSET_FLAGS } from '../../../constants/index.js';
import { hypixel } from '../../../api/hypixel.js';
import { autocorrect, compareAlphabetically, getWeekOfYear, logger, safePromiseAll, upperCaseFirstChar } from '../../../functions/index.js';
import { ModelManager } from './ModelManager.js';


export class PlayerManager extends ModelManager {
	/**
	 * wether a player db xp update is currently running
	 * @type {boolean}
	 */
	#isUpdatingXp = false;

	/**
	 * wether a player db ign update is currently running
	 * @type {boolean}
	 */
	#isUpdatingIgns = false;

	constructor(options) {
		super(options);

		/**
		 * @type {import('discord.js').Collection<string, import('../models/Player').Player>}
		 */
		this.cache;
		/**
		 * @type {import('../models/Player').Player}
		 */
		this.model;
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
				// player is in a guild that the bot tracks (guildId !== null)
				guildId: {
					[Op.ne]: null,
				},
			},
		});

		this.sortAlphabetically();
	}

	/**
	 * add a player to the cache and sweep the player's hypixelGuild's player cache
	 * @param {string} key
	 * @param {import('../models/Player').Player} value
	 */
	set(key, value) {
		this.client.hypixelGuilds.sweepPlayerCache(value.guildId);
		this.cache.set(key, value);

		return this;
	}

	/**
	 * delete a player from the cache and sweep the player's hypixelGuild's player cache
	 * @param {string|import('../models/Player').Player} idOrPlayer
	 */
	delete(idOrPlayer) {
		/** @type {import('../models/Player').Player} */
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
	 * @returns {Promise<import('../models/Player').Player>}
	 */
	async add(options = {}, isAddingSingleEntry = true) {
		const newPlayer = await super.add(options);

		this.client.hypixelGuilds.sweepPlayerCache(newPlayer.guildId);

		if (isAddingSingleEntry) {
			this.sortAlphabetically();

			newPlayer.updateData({
				reason: `joined ${newPlayer.hypixelGuild?.name}`,
			});
		}

		return newPlayer;
	}

	/**
	 * deletes all unnecessary db entries
	 */
	async sweepDb() {
		/** @type {import('../models/Player').Player[]} */
		const playersToSweep = await this.model.findAll({
			where: {
				guildId: null,
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
	 * @returns {?import('../models/Player').Player}
	 */
	getByIgn(ign) {
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
	findByIgn(ignInput) {
		return this.cache.find(({ ign }) => ign === ignInput) ?? null;
	}

	/**
	 * autocorrects the input to a player ign
	 * @param {string} input
	 * @returns {import('../models/Player').Player}
	 */
	autocorrectToPlayer(input) {
		return autocorrect(input, this.cache, 'ign');
	}

	/**
	 * get a player by their discord ID
	 * @param {string} id discord id of the player
	 * @returns {?import('../models/Player').Player}
	 */
	getById(id) {
		if (!id) return null;
		return this.cache.find(({ discordId }) => discordId === id) ?? null;
	}

	/**
	 * sort players alphabetically by IGNs
	 */
	sortAlphabetically() {
		this.cache.sort(compareAlphabetically);
		return this;
	}

	/**
	 * update db entries and linked discord members of all players
	 * @param {import('../models/Player').PlayerUpdateOptions} options
	 */
	async updateData(options = {}) {
		await Promise.all([
			this.updateXp({ shouldOnlyAwaitUpdateXp: true, ...options }),
			this.updateIgns(),
		]);

		return this;
	}

	/**
	 * update Xp for all players
	 * @param {import('../models/Player').PlayerUpdateOptions} options
	 */
	async updateXp(options) {
		if (this.#isUpdatingXp) return this;
		this.#isUpdatingXp = true;

		try {
			// the hypxiel api encountered an error before
			if (this.client.config.get('HYPIXEL_SKYBLOCK_API_ERROR')) {
				// reset error every full hour
				if (new Date().getMinutes() >= this.client.config.get('DATABASE_UPDATE_INTERVAL')) {
					logger.warn('[PLAYERS UPDATE XP]: auto updates disabled');
					return this;
				}

				this.client.config.set('HYPIXEL_SKYBLOCK_API_ERROR', false);
			}

			try {
				for (const player of this.cache.values()) {
					if (hypixel.rateLimit.remaining < hypixel.rateLimit.limit * 0.1 && hypixel.rateLimit.remaining !== -1) await sleep((hypixel.rateLimit.reset * 1_000) + 1_000);

					await player.updateData({ rejectOnAPIError: true, ...options });
				}
			} catch (error) {
				logger.error('[PLAYERS UPDATE XP]', error);
			}

			return this;
		} finally {
			this.#isUpdatingXp = false;
		}
	}

	/**
	 * updates all IGNs and logs changes via the log handler
	 */
	async updateIgns() {
		if (this.#isUpdatingIgns) return this;
		this.#isUpdatingIgns = true;

		try {
			// the hypxiel api encountered an error before
			if (this.client.config.get('MOJANG_API_ERROR')) {
				// reset error every full hour
				if (new Date().getMinutes() >= this.client.config.get('DATABASE_UPDATE_INTERVAL')) {
					logger.warn('[PLAYERS UPDATE IGNS]: auto updates disabled');
					return this;
				}

				this.client.config.set('MOJANG_API_ERROR', false);
			}


			/** @type {Record<string, string>[]} */
			const log = [];

			// API calls
			await Promise.all(this.cache.map(async (player) => {
				const result = await player.updateIgn();

				if (result) {
					log.push({
						guildId: player.guildId,
						ignChange: `${result.oldIgn} -> ${result.newIgn}`,
					});
				}
			}));

			// logging
			if (!log.length) return this;

			/** @type {[string, string[]][]} */
			const affectedGuilds = Object.fromEntries([ ...new Set(log.map(({ guildId }) => guildId)) ].map(id => [ id, [] ]));

			for (const { guildId, ignChange } of log) {
				affectedGuilds[guildId].push(ignChange);
			}

			/**
			 * @type {MessageEmbed[]}
			 */
			const embeds = [];
			/**
			 * @param {import('../models/HypixelGuild').HypixelGuild|string} guild
			 * @param {number} ignChangesAmount
			 */
			const createEmbed = (guild, ignChangesAmount) => {
				const embed = this.client.defaultEmbed
					.setTitle(`${typeof guild !== 'string' ? guild : upperCaseFirstChar(guild)} Player Database: ${ignChangesAmount} change${ignChangesAmount !== 1 ? 's' : ''}`)
					.setDescription(`Number of players: ${typeof guild !== 'string' ? guild.playerCount : this.cache.filter(({ guildId }) => guildId === guild).size}`);

				embeds.push(embed);

				return embed;
			};

			for (const [ guild, ignChanges ] of Object.entries(affectedGuilds)
				.map(([ guildId, data ]) => [ this.client.hypixelGuilds.cache.get(guildId) ?? guildId, data ])
				.sort(([ guildNameA ], [ guildNameB ]) => compareAlphabetically(guildNameA, guildNameB))
			) {
				const logParts = Util.splitMessage(
					Formatters.codeBlock(ignChanges.sort(compareAlphabetically).join('\n')),
					{ maxLength: EMBED_FIELD_MAX_CHARS, char: '\n', prepend: '```\n', append: '```' },
				);

				let embed = createEmbed(guild, ignChanges.length);
				let currentLength = embed.length;

				while (logParts.length) {
					const name = `${'new ign'.padEnd(150, '\xa0')}\u200b`;
					const value = logParts.shift();

					if (currentLength + name.length + value.length <= EMBED_MAX_CHARS && embed.fields.length < EMBED_MAX_FIELDS) {
						embed.addFields({ name, value });
						currentLength += name.length + value.length;
					} else {
						embed = createEmbed(guild, ignChanges.length);
						embed.addFields({ name, value });
						currentLength = embed.length;
					}
				}
			}

			this.client.log(...embeds);

			return this;
		} finally {
			this.#isUpdatingIgns = false;
		}
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
		if (config.get('COMPETITION_SCHEDULED')) {
			if (config.get('COMPETITION_START_TIME') - 10_000 > Date.now()) {
				this.client.schedule('competitionStart', new CronJob({
					cronTime: new Date(config.get('COMPETITION_START_TIME')),
					onTick: () => this.#startCompetition(),
					start: true,
				}));
			} else if (!config.get('COMPETITION_RUNNING')) {
				this.#startCompetition();
			}
		}

		// auto competition ending
		if (config.get('COMPETITION_END_TIME') - 10_000 > Date.now()) {
			this.client.schedule('competitionEnd', new CronJob({
				cronTime: new Date(config.get('COMPETITION_END_TIME')),
				onTick: () => this.#endCompetition(),
				start: true,
			}));
		} else if (config.get('COMPETITION_RUNNING')) {
			this.#endCompetition();
		}

		// mayor change reset
		const NEXT_MAYOR_TIME = config.get('LAST_MAYOR_XP_RESET_TIME') + MAYOR_CHANGE_INTERVAL;

		if (NEXT_MAYOR_TIME - 10_000 > Date.now()) {
			this.client.schedule('mayorXpReset', new CronJob({
				cronTime: new Date(NEXT_MAYOR_TIME),
				onTick: () => this.#performMayorXpReset(),
				start: true,
			}));
		} else {
			this.#performMayorXpReset();
		}

		const now = new Date();

		// daily reset
		if (new Date(config.get('LAST_DAILY_XP_RESET_TIME')).getUTCDay() !== now.getUTCDay()) this.#performDailyXpReset();

		// each day at 00:00:00
		this.client.schedule('dailyXpReset', new CronJob({
			cronTime: '0 0 0 * * *',
			timeZone: 'GMT',
			onTick: () => this.#performDailyXpReset(),
			start: true,
		}));

		// weekly reset
		if (getWeekOfYear(new Date(config.get('LAST_WEEKLY_XP_RESET_TIME'))) !== getWeekOfYear(now)) this.#performWeeklyXpReset();

		// each monday at 00:00:00
		this.client.schedule('weeklyXpReset', new CronJob({
			cronTime: '0 0 0 * * MON',
			timeZone: 'GMT',
			onTick: () => this.#performWeeklyXpReset(),
			start: true,
		}));

		// monthly reset
		if (new Date(config.get('LAST_MONTHLY_XP_RESET_TIME')).getUTCMonth() !== now.getUTCMonth()) this.#performMonthlyXpReset();

		// the first of each month at 00:00:00
		this.client.schedule('monthlyXpReset', new CronJob({
			cronTime: '0 0 0 1 * *',
			timeZone: 'GMT',
			onTick: () => this.#performMonthlyXpReset(),
			start: true,
		}));
	}

	/**
	 * resets competitionStart xp, updates the config and logs the event
	 */
	async #startCompetition() {
		const { config } = this.client;

		await this.resetXp({ offsetToReset: OFFSET_FLAGS.COMPETITION_START });

		config.set('COMPETITION_RUNNING', true);
		config.set('COMPETITION_SCHEDULED', false);

		this.client.log(this.client.defaultEmbed
			.setTitle('Guild Competition')
			.setDescription('started'),
		);
	}

	/**
	 * resets competitionEnd xp, updates the config and logs the event
	 */
	async #endCompetition() {
		const { config } = this.client;

		await this.resetXp({ offsetToReset: OFFSET_FLAGS.COMPETITION_END });

		config.set('COMPETITION_RUNNING', false);

		this.client.log(this.client.defaultEmbed
			.setTitle('Guild Competition')
			.setDescription('ended'),
		);
	}

	/**
	 * resets offsetMayor xp, updates the config and logs the event
	 */
	async #performMayorXpReset() {
		const { config } = this.client;
		const LAST_MAYOR_XP_RESET_TIME = config.get('LAST_MAYOR_XP_RESET_TIME');

		// if the bot skipped a mayor change readd the interval time
		let currentMayorTime = LAST_MAYOR_XP_RESET_TIME + MAYOR_CHANGE_INTERVAL;
		while (currentMayorTime + MAYOR_CHANGE_INTERVAL < Date.now()) currentMayorTime += MAYOR_CHANGE_INTERVAL;

		await this.resetXp({ offsetToReset: OFFSET_FLAGS.MAYOR });

		config.set('LAST_MAYOR_XP_RESET_TIME', currentMayorTime);

		this.client.log(this.client.defaultEmbed
			.setTitle('Current Mayor XP Tracking')
			.setDescription(`reset the xp gained from all ${this.size} guild members`),
		);

		this.client.schedule('mayorXpReset', new CronJob({
			cronTime: new Date(currentMayorTime + MAYOR_CHANGE_INTERVAL),
			onTick: () => this.#performMayorXpReset(),
			start: true,
		}));
	}

	/**
	 * shifts the daily xp array, updates the config and logs the event
	 */
	async #performDailyXpReset() {
		const { config } = this.client;

		await this.resetXp({ offsetToReset: OFFSET_FLAGS.DAY });

		config.set('LAST_DAILY_XP_RESET_TIME', Date.now());

		this.client.log(this.client.defaultEmbed
			.setTitle('Daily XP Tracking')
			.setDescription(`reset the xp gained from all ${this.size} guild members`),
		);

		this.#updateMainProfiles();
	}

	/**
	 * resets offsetWeek xp, updates the config and logs the event
	 */
	async #performWeeklyXpReset() {
		const { config } = this.client;

		await this.resetXp({ offsetToReset: OFFSET_FLAGS.WEEK });

		config.set('LAST_WEEKLY_XP_RESET_TIME', Date.now());

		this.client.log(this.client.defaultEmbed
			.setTitle('Weekly XP Tracking')
			.setDescription(`reset the xp gained from all ${this.size} guild members`),
		);
	}

	/**
	 * resets offsetMonth xp, updates the config and logs the event
	 */
	async #performMonthlyXpReset() {
		const { config } = this.client;

		await this.resetXp({ offsetToReset: OFFSET_FLAGS.MONTH });

		config.set('LAST_MONTHLY_XP_RESET_TIME', Date.now());

		this.client.log(this.client.defaultEmbed
			.setTitle('Monthly XP Tracking')
			.setDescription(`reset the xp gained from all ${this.size} guild members`),
		);
	}

	/**
	 * checks all players if their current main profile is still valid
	 */
	async #updateMainProfiles() {
		// the hypxiel api encountered an error before
		if (this.client.config.get('HYPIXEL_SKYBLOCK_API_ERROR')) {
			// reset error every full hour
			if (new Date().getMinutes() >= this.client.config.get('DATABASE_UPDATE_INTERVAL')) {
				logger.warn('[PLAYERS UPDATE MAIN PROFILE]: API error');
				return this;
			}

			this.client.config.set('HYPIXEL_SKYBLOCK_API_ERROR', false);
		}

		const log = [];

		for (const player of this.cache.values()) {
			if (player.notInGuild) continue;

			try {
				if (hypixel.rateLimit.remaining < hypixel.rateLimit.limit * 0.1 && hypixel.rateLimit.remaining !== -1) await sleep((hypixel.rateLimit.reset * 1_000) + 1_000);

				const result = await player.fetchMainProfile();

				if (!result) continue;

				log.push({
					guildId: player.guildId,
					mainProfileUpdate: `-\xa0${player}: ${result.oldProfileName} -> ${result.newProfileName}`,
				});
			} catch (error) {
				logger.error('[UPDATE MAIN PROFILE]', error);

				if (typeof error === 'string') {
					log.push({
						guildId: player.guildId,
						mainProfileUpdate: `-\xa0${player}: ${error}`,
					});
				}
			}
		}

		if (!log.length) return this;

		/** @type {[string, string[]][]} */
		const affectedGuilds = Object.fromEntries([ ...new Set(log.map(({ guildId }) => guildId)) ].map(id => [ id, [] ]));

		for (const { guildId, mainProfileUpdate } of log) {
			affectedGuilds[guildId].push(mainProfileUpdate);
		}

		/**
		 * @type {MessageEmbed[]}
		 */
		const embeds = [];
		/**
		 * @param {import('../models/HypixelGuild').HypixelGuild|string} guild
		 * @param {number} mainProfileChangesAmount
		 */
		const createEmbed = (guild, mainProfileChangesAmount) => {
			const embed = new MessageEmbed()
				.setColor(this.client.config.get('EMBED_RED'))
				.setTitle(`${typeof guild !== 'string' ? guild : upperCaseFirstChar(guild)} Player Database: ${mainProfileChangesAmount} change${mainProfileChangesAmount !== 1 ? 's' : ''}`)
				.setDescription(`Number of players: ${typeof guild !== 'string' ? guild.playerCount : this.cache.filter(({ guildId }) => guildId === guild).size}`)
				.setTimestamp();

			embeds.push(embed);

			return embed;
		};

		for (const [ guild, mainProfileUpdate ] of Object.entries(affectedGuilds)
			.map(([ guildId, data ]) => [ this.client.hypixelGuilds.cache.get(guildId) ?? guildId, data ])
			.sort(([ guildNameA ], [ guildNameB ]) => compareAlphabetically(guildNameA, guildNameB))
		) {
			const logParts = Util.splitMessage(
				Formatters.codeBlock('diff', mainProfileUpdate.sort(compareAlphabetically).join('\n')),
				{ maxLength: EMBED_FIELD_MAX_CHARS, char: '\n', prepend: '```diff\n', append: '```' },
			);

			let embed = createEmbed(guild, mainProfileUpdate.length);
			let currentLength = embed.length;

			while (logParts.length) {
				const name = `${'main profile update'.padEnd(150, '\xa0')}\u200b`;
				const value = logParts.shift();

				if (currentLength + name.length + value.length <= EMBED_MAX_CHARS && embed.fields.length < EMBED_MAX_FIELDS) {
					embed.addFields({ name, value });
					currentLength += name.length + value.length;
				} else {
					embed = createEmbed(guild, mainProfileUpdate.length);
					embed.addFields({ name, value });
					currentLength = embed.length;
				}
			}
		}

		this.client.log(...embeds);

		return this;
	}
}
