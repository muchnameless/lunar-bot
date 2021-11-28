import { setTimeout as sleep } from 'node:timers/promises';
import { Collection, MessageEmbed, Formatters, Util } from 'discord.js';
import pkg from 'sequelize';
const { Op } = pkg;
import { CronJob } from 'cron';
import {
	EMBED_FIELD_MAX_CHARS,
	EMBED_MAX_CHARS,
	EMBED_MAX_FIELDS,
	MAYOR_CHANGE_INTERVAL,
	OFFSET_FLAGS,
} from '../../../constants';
import { hypixel } from '../../../api';
import {
	autocorrect,
	compareAlphabetically,
	getWeekOfYear,
	logger,
	safePromiseAll,
	seconds,
	upperCaseFirstChar,
} from '../../../functions';
import { ModelManager } from './ModelManager';
import type { ModelResovable } from './ModelManager';
import type { Player, PlayerUpdateOptions, ResetXpOptions, TransferXpOptions } from '../models/Player';
import type { HypixelGuild } from '../models/HypixelGuild';

export class PlayerManager extends ModelManager<Player> {
	/**
	 * player db xp update
	 */
	#updateXpPromise: Promise<this> | null = null;
	/**
	 * player db ign update
	 */
	#updateIgnPromise: Promise<this> | null = null;
	/**
	 * player db main SkyBlock profile update
	 */
	#updateMainProfilesPromise: Promise<this> | null = null;

	/**
	 * get players from all guilds (no bridgers or errors)
	 */
	get inGuild() {
		return this.cache.filter((player) => player.inGuild());
	}

	/**
	 * loads the player cache and sorts alphabetically by IGN
	 */
	override async loadCache() {
		await super.loadCache({
			where: {
				guildId: {
					// player is in a guild or error
					[Op.ne]: null,
				},
			},
		});

		return this.sortAlphabetically();
	}

	/**
	 * add a player to the cache and sweep the player's hypixelGuild's player cache
	 * @param key
	 * @param value
	 */
	set(key: string, value: Player) {
		this.client.hypixelGuilds.sweepPlayerCache(value.guildId);
		this.cache.set(key, value);
		return this;
	}

	/**
	 * delete a player from the cache and sweep the player's hypixelGuild's player cache
	 * @param idOrPlayer
	 */
	delete(idOrPlayer: ModelResovable<Player>) {
		const player = this.resolve(idOrPlayer);
		if (!player) throw new Error(`[PLAYER HANDLER UNCACHE]: invalid input: ${idOrPlayer}`);

		player.uncache();
		return this;
	}

	/**
	 * sweep the cache and the hypixelGuild players cache
	 * @param fn
	 */
	sweep(fn: (value: Player, key: string, collection: this['cache']) => boolean) {
		this.client.hypixelGuilds.sweepPlayerCache();

		return this.cache.sweep(fn);
	}

	/**
	 * clears the cache and the hypixelGuild players cache
	 */
	clear() {
		this.client.hypixelGuilds.sweepPlayerCache();
		this.cache.clear();
		return this;
	}

	/**
	 * sort the cache and sweeps the hypixelGuild players cache
	 * @param compareFunction
	 */
	sort(compareFunction: (firstValue: Player, secondValue: Player, firstKey: string, secondKey: string) => number) {
		this.client.hypixelGuilds.sweepPlayerCache();
		this.cache.sort(compareFunction);
		return this;
	}

	/**
	 * add a player to the db and db cache
	 * @param options options for the new db entry
	 * @param isAddingSingleEntry wether to call sortAlphabetically() and updateXp() after adding the new entry
	 */
	override async add(options: Player['_creationAttributes'], isAddingSingleEntry = true) {
		const newPlayer = await super.add(options);

		this.client.hypixelGuilds.sweepPlayerCache(newPlayer.guildId);

		if (isAddingSingleEntry) {
			this.sortAlphabetically();

			newPlayer.updateData({
				reason: `joined ${newPlayer.guildName}`,
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
				guildId: null,
				paid: false,
			},
			attributes: [this.primaryKey, 'ign'],
		});

		await safePromiseAll(playersToSweep.map((player) => player.destroy()));

		const AMOUNT = playersToSweep.length;

		logger.warn(
			{
				sweptPlayers: playersToSweep.map(({ ign }) => ign),
				amount: playersToSweep.length,
			},
			'[SWEEP DB]',
		);

		return AMOUNT;
	}

	/**
	 * get a player by their IGN, case insensitive and with auto-correction
	 * @param ign ign of the player
	 */
	getByIgn(ign: string) {
		if (!ign) return null;

		const { similarity, value } = this.#autocorrectToPlayer(ign);

		return similarity >= this.client.config.get('AUTOCORRECT_THRESHOLD') ? value : null;
	}

	/**
	 * find a player by their IGN, case sensitive and without auto-correction
	 * @param ignInput ign of the player
	 */
	findByIgn(ignInput: string) {
		return this.cache.find(({ ign }) => ign === ignInput) ?? null;
	}

	/**
	 * autocorrects the input to a player ign
	 * @param input
	 */
	#autocorrectToPlayer(input: string) {
		return autocorrect(input, this.cache, 'ign');
	}

	/**
	 * get a player by their discord ID
	 * @param id discord id of the player
	 */
	getById(id: string) {
		if (!id) return null;
		return this.cache.find(({ discordId }) => discordId === id) ?? null;
	}

	/**
	 * sort players alphabetically by IGNs
	 */
	sortAlphabetically() {
		this.cache.sort(({ ign: a }, { ign: b }) => compareAlphabetically(a, b));
		return this;
	}

	/**
	 * update db entries and linked discord members of all players
	 * @param options
	 */
	async updateData(options?: PlayerUpdateOptions) {
		await Promise.all([this.updateXp({ shouldOnlyAwaitUpdateXp: true, ...options }), this.updateIgns()]);

		return this;
	}

	/**
	 * update Xp for all players
	 * @param options
	 */
	async updateXp(options?: PlayerUpdateOptions) {
		if (this.#updateXpPromise) return this.#updateXpPromise;

		try {
			return await (this.#updateXpPromise = this.#updateXp(options));
		} finally {
			this.#updateXpPromise = null;
		}
	}
	/**
	 * should only ever be called from within updateXp()
	 * @internal
	 */
	async #updateXp(options?: PlayerUpdateOptions) {
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

			for (const player of this.cache.values()) {
				if (hypixel.rateLimit.remaining < hypixel.rateLimit.limit * 0.1 && hypixel.rateLimit.remaining !== -1) {
					await sleep(hypixel.rateLimit.reset - Date.now() + seconds(1));
				}

				await player.updateData({ rejectOnAPIError: true, ...options });
			}

			return this;
		} catch (error) {
			logger.error(error, '[PLAYERS UPDATE XP]');
			return this;
		}
	}

	/**
	 * updates all IGNs and logs changes via the log handler
	 */
	async updateIgns() {
		if (this.#updateIgnPromise) return this.#updateIgnPromise;

		try {
			return await (this.#updateIgnPromise = this.#updateIgns());
		} finally {
			this.#updateIgnPromise = null;
		}
	}
	/**
	 * should only ever be called from within updateIgns()
	 * @internal
	 */
	async #updateIgns() {
		// the hypxiel api encountered an error before
		if (this.client.config.get('MOJANG_API_ERROR')) {
			// reset error every full hour
			if (new Date().getMinutes() >= this.client.config.get('DATABASE_UPDATE_INTERVAL')) {
				logger.warn('[PLAYERS UPDATE IGNS]: auto updates disabled');
				return this;
			}

			this.client.config.set('MOJANG_API_ERROR', false);
		}

		const log = new Collection<
			string | null,
			{
				guildName: string;
				playerCount: number;
				ignChanges: string[];
			}
		>();

		// API calls
		await Promise.all(
			this.cache.map(async (player) => {
				const result = await player.updateIgn();
				if (!result) return;

				// first change for this guild
				if (!log.has(player.guildId)) {
					const { guildName } = player;

					return log.set(player.guildId, {
						guildName,
						playerCount:
							this.client.hypixelGuilds.cache.find(({ name }) => name === guildName)?.playerCount ??
							this.cache.filter(({ guildId: e }) => e === player.guildId).size,
						ignChanges: [`${result.oldIgn} -> ${result.newIgn}`],
					});
				}

				// further change for this guild
				return log.get(player.guildId)!.ignChanges.push(`${result.oldIgn} -> ${result.newIgn}`);
			}),
		);

		// logging
		if (!log.size) return this;

		const embeds: MessageEmbed[] = [];

		/**
		 * @param guildName
		 * @param playerCount
		 * @param ignChangesAmount
		 */
		const createEmbed = (guildName: string | null, playerCount: number, ignChangesAmount: number) => {
			const embed = this.client.defaultEmbed
				.setTitle(`${guildName} Player Database: ${ignChangesAmount} change${ignChangesAmount !== 1 ? 's' : ''}`)
				.setDescription(`Number of players: ${playerCount}`);

			embeds.push(embed);

			return embed;
		};

		for (const { guildName, playerCount, ignChanges } of log
			.sort(({ guildName: a }, { guildName: b }) => compareAlphabetically(a, b))
			.values()) {
			const logParts = Util.splitMessage(Formatters.codeBlock(ignChanges.sort(compareAlphabetically).join('\n')), {
				maxLength: EMBED_FIELD_MAX_CHARS,
				char: '\n',
				prepend: '```\n',
				append: '```',
			});

			let embed = createEmbed(guildName, playerCount, ignChanges.length);
			let currentLength = embed.length;

			while (logParts.length) {
				const name = `${'new ign'.padEnd(150, '\u00A0')}\u200B`;
				const value = logParts.shift()!;

				if (currentLength + name.length + value.length <= EMBED_MAX_CHARS && embed.fields.length < EMBED_MAX_FIELDS) {
					embed.addFields({ name, value });
					currentLength += name.length + value.length;
				} else {
					embed = createEmbed(guildName, playerCount, ignChanges.length);
					embed.addFields({ name, value });
					currentLength = embed.length;
				}
			}
		}

		this.client.log(...embeds);

		return this;
	}

	/**
	 * checks all players if their current main profile is still valid
	 */
	async updateMainProfiles() {
		if (this.#updateMainProfilesPromise) return this.#updateMainProfilesPromise;

		try {
			return await (this.#updateMainProfilesPromise = this.#updateMainProfiles());
		} finally {
			this.#updateMainProfilesPromise = null;
		}
	}
	/**
	 * should only ever be called from within updateMainProfiles()
	 * @internal
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

		const log = new Collection<HypixelGuild, string[]>();

		for (const player of this.cache.values()) {
			if (!player.inGuild()) continue;

			try {
				if (hypixel.rateLimit.remaining < hypixel.rateLimit.limit * 0.1 && hypixel.rateLimit.remaining !== -1) {
					await sleep(hypixel.rateLimit.reset - Date.now() + seconds(1));
				}

				const result = await player.fetchMainProfile();
				if (!result) continue;

				const { hypixelGuild } = player;

				if (!log.has(hypixelGuild)) {
					log.set(hypixelGuild, [`-\u00A0${player}: ${result.oldProfileName} -> ${result.newProfileName}`]);
					continue;
				}

				log.get(hypixelGuild)!.push(`-\u00A0${player}: ${result.oldProfileName} -> ${result.newProfileName}`);
			} catch (error) {
				logger.error(error, '[UPDATE MAIN PROFILE]');

				if (typeof error === 'string') {
					const { hypixelGuild } = player;

					if (!log.has(hypixelGuild)) {
						log.set(hypixelGuild, [`-\u00A0${player}: ${error}`]);
						continue;
					}

					log.get(hypixelGuild)!.push(`-\u00A0${player}: ${error}`);
				}
			}
		}

		if (!log.size) return this;

		const embeds: MessageEmbed[] = [];

		/**
		 * @param guild
		 * @param mainProfileChangesAmount
		 */
		const createEmbed = (guild: HypixelGuild, mainProfileChangesAmount: number) => {
			const embed = new MessageEmbed()
				.setColor(this.client.config.get('EMBED_RED'))
				.setTitle(
					`${upperCaseFirstChar(guild.name)} Player Database: ${mainProfileChangesAmount} change${
						mainProfileChangesAmount !== 1 ? 's' : ''
					}`,
				)
				.setDescription(`Number of players: ${guild.playerCount}`)
				.setTimestamp();

			embeds.push(embed);

			return embed;
		};

		for (const [guild, mainProfileUpdate] of log.sort((_, __, { name: a }, { name: b }) =>
			compareAlphabetically(a, b),
		)) {
			const logParts = Util.splitMessage(
				Formatters.codeBlock('diff', mainProfileUpdate.sort(compareAlphabetically).join('\n')),
				{ maxLength: EMBED_FIELD_MAX_CHARS, char: '\n', prepend: '```diff\n', append: '```' },
			);

			let embed = createEmbed(guild, mainProfileUpdate.length);
			let currentLength = embed.length;

			while (logParts.length) {
				const name = `${'main profile update'.padEnd(150, '\u00A0')}\u200B`;
				const value = logParts.shift()!;

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

	/**
	 * transfers xp of all players
	 * @param options transfer options
	 */
	async transferXp(options: TransferXpOptions) {
		await safePromiseAll(this.cache.map((player) => player.transferXp(options)));
		return this;
	}

	/**
	 * reset xp of all players
	 * @param options reset options
	 */
	async resetXp(options?: ResetXpOptions) {
		await safePromiseAll(this.cache.map((player) => player.resetXp(options)));
		return this;
	}

	/**
	 * register cron jobs for all xp resets
	 */
	override schedule() {
		const { config } = this.client;

		// auto competition starting
		if (config.get('COMPETITION_SCHEDULED')) {
			if (config.get('COMPETITION_START_TIME') - seconds(10) > Date.now()) {
				this.client.cronJobs.schedule(
					`${this.constructor.name}:competitionStart`,
					new CronJob({
						cronTime: new Date(config.get('COMPETITION_START_TIME')),
						onTick: () => this.#startCompetition(),
						start: true,
					}),
				);
			} else if (!config.get('COMPETITION_RUNNING')) {
				this.#startCompetition();
			}
		}

		// auto competition ending
		if (config.get('COMPETITION_END_TIME') - seconds(10) > Date.now()) {
			this.client.cronJobs.schedule(
				`${this.constructor.name}:competitionEnd`,
				new CronJob({
					cronTime: new Date(config.get('COMPETITION_END_TIME')),
					onTick: () => this.#endCompetition(),
					start: true,
				}),
			);
		} else if (config.get('COMPETITION_RUNNING')) {
			this.#endCompetition();
		}

		// mayor change reset
		const NEXT_MAYOR_TIME = config.get('LAST_MAYOR_XP_RESET_TIME') + MAYOR_CHANGE_INTERVAL;

		if (NEXT_MAYOR_TIME - seconds(10) > Date.now()) {
			this.client.cronJobs.schedule(
				`${this.constructor.name}:mayorXpReset`,
				new CronJob({
					cronTime: new Date(NEXT_MAYOR_TIME),
					onTick: () => this.#performMayorXpReset(),
					start: true,
				}),
			);
		} else {
			this.#performMayorXpReset();
		}

		const now = new Date();

		// daily reset
		if (new Date(config.get('LAST_DAILY_XP_RESET_TIME')).getUTCDay() !== now.getUTCDay()) this.#performDailyXpReset();

		// each day at 00:00:00
		this.client.cronJobs.schedule(
			`${this.constructor.name}:dailyXpReset`,
			new CronJob({
				cronTime: '0 0 0 * * *',
				timeZone: 'GMT',
				onTick: () => this.#performDailyXpReset(),
				start: true,
			}),
		);

		// weekly reset
		if (getWeekOfYear(new Date(config.get('LAST_WEEKLY_XP_RESET_TIME'))) !== getWeekOfYear(now)) {
			this.#performWeeklyXpReset();
		}

		// each monday at 00:00:00
		this.client.cronJobs.schedule(
			`${this.constructor.name}:weeklyXpReset`,
			new CronJob({
				cronTime: '0 0 0 * * MON',
				timeZone: 'GMT',
				onTick: () => this.#performWeeklyXpReset(),
				start: true,
			}),
		);

		// monthly reset
		if (new Date(config.get('LAST_MONTHLY_XP_RESET_TIME')).getUTCMonth() !== now.getUTCMonth()) {
			this.#performMonthlyXpReset();
		}

		// the first of each month at 00:00:00
		this.client.cronJobs.schedule(
			`${this.constructor.name}:monthlyXpReset`,
			new CronJob({
				cronTime: '0 0 0 1 * *',
				timeZone: 'GMT',
				onTick: () => this.#performMonthlyXpReset(),
				start: true,
			}),
		);

		return this;
	}

	/**
	 * resets competitionStart xp, updates the config and logs the event
	 */
	async #startCompetition() {
		await Promise.all([
			this.resetXp({ offsetToReset: OFFSET_FLAGS.COMPETITION_START }),
			this.client.config.set('COMPETITION_RUNNING', true),
			this.client.config.set('COMPETITION_SCHEDULED', false),
		]);

		this.client.log(this.client.defaultEmbed.setTitle('Guild Competition').setDescription('started'));

		return this;
	}

	/**
	 * resets competitionEnd xp, updates the config and logs the event
	 */
	async #endCompetition() {
		await Promise.all([
			this.resetXp({ offsetToReset: OFFSET_FLAGS.COMPETITION_END }),
			this.client.config.set('COMPETITION_RUNNING', false),
		]);

		this.client.log(this.client.defaultEmbed.setTitle('Guild Competition').setDescription('ended'));

		return this;
	}

	/**
	 * resets offsetMayor xp, updates the config and logs the event
	 */
	async #performMayorXpReset() {
		// if the bot skipped a mayor change readd the interval time
		let currentMayorTime = this.client.config.get('LAST_MAYOR_XP_RESET_TIME') + MAYOR_CHANGE_INTERVAL;
		while (currentMayorTime + MAYOR_CHANGE_INTERVAL < Date.now()) currentMayorTime += MAYOR_CHANGE_INTERVAL;

		await Promise.all([
			this.resetXp({ offsetToReset: OFFSET_FLAGS.MAYOR }),
			this.client.config.set('LAST_MAYOR_XP_RESET_TIME', currentMayorTime),
		]);

		this.client.log(
			this.client.defaultEmbed
				.setTitle('Current Mayor XP Tracking')
				.setDescription(`reset the xp gained from all ${this.cache.size} guild members`),
		);

		this.client.cronJobs.schedule(
			`${this.constructor.name}:mayorXpReset`,
			new CronJob({
				cronTime: new Date(currentMayorTime + MAYOR_CHANGE_INTERVAL),
				onTick: () => this.#performMayorXpReset(),
				start: true,
			}),
		);

		return this;
	}

	/**
	 * shifts the daily xp array, updates the config and logs the event
	 */
	async #performDailyXpReset() {
		await Promise.all([
			this.resetXp({ offsetToReset: OFFSET_FLAGS.DAY }),
			this.client.config.set('LAST_DAILY_XP_RESET_TIME', Date.now()),
		]);

		this.client.log(
			this.client.defaultEmbed
				.setTitle('Daily XP Tracking')
				.setDescription(`reset the xp gained from all ${this.cache.size} guild members`),
		);

		return this.updateMainProfiles();
	}

	/**
	 * resets offsetWeek xp, updates the config and logs the event
	 */
	async #performWeeklyXpReset() {
		await Promise.all([
			this.resetXp({ offsetToReset: OFFSET_FLAGS.WEEK }),
			this.client.config.set('LAST_WEEKLY_XP_RESET_TIME', Date.now()),
		]);

		this.client.log(
			this.client.defaultEmbed
				.setTitle('Weekly XP Tracking')
				.setDescription(`reset the xp gained from all ${this.cache.size} guild members`),
		);

		return this;
	}

	/**
	 * resets offsetMonth xp, updates the config and logs the event
	 */
	async #performMonthlyXpReset() {
		await Promise.all([
			this.resetXp({ offsetToReset: OFFSET_FLAGS.MONTH }),
			this.client.config.set('LAST_MONTHLY_XP_RESET_TIME', Date.now()),
		]);

		this.client.log(
			this.client.defaultEmbed
				.setTitle('Monthly XP Tracking')
				.setDescription(`reset the xp gained from all ${this.cache.size} guild members`),
		);

		return this;
	}
}
