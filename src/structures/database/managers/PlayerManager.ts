import { setTimeout as sleep } from 'node:timers/promises';
import { codeBlock, Collection, EmbedBuilder, embedLength } from 'discord.js';
import { Op } from 'sequelize';
import { CronJob } from 'cron';
import {
	EMBED_FIELD_MAX_CHARS,
	EMBED_MAX_CHARS,
	EMBED_MAX_FIELDS,
	MAYOR_CHANGE_INTERVAL,
	Offset,
	XP_OFFSETS_TIME,
} from '../../../constants';
import { hypixel } from '../../../api';
import {
	autocorrect,
	compareAlphabetically,
	getWeekOfYear,
	safePromiseAll,
	seconds,
	splitMessage,
	upperCaseFirstChar,
} from '../../../functions';
import { logger } from '../../../logger';
import { ModelManager } from './ModelManager';
import type { APIEmbed } from 'discord-api-types/v10';
import type { JSONEncodable } from 'discord.js';
import type { Attributes, CreationAttributes, FindOptions } from 'sequelize';
import type { ModelResovable } from './ModelManager';
import type { Player, PlayerInGuild, PlayerUpdateOptions, ResetXpOptions, TransferXpOptions } from '../models/Player';
import type { HypixelGuild } from '../models/HypixelGuild';

export class PlayerManager extends ModelManager<Player> {
	/**
	 * player db xp update
	 */
	private _updateXpPromise: Promise<this> | null = null;
	/**
	 * player db ign update
	 */
	private _updateIgnPromise: Promise<this> | null = null;
	/**
	 * player db main SkyBlock profile update
	 */
	private _updateMainProfilesPromise: Promise<this> | null = null;

	/**
	 * get players from all guilds (no bridgers or errors)
	 */
	get inGuild(): Collection<string, PlayerInGuild> {
		return this.cache.filter((player) => player.inGuild()) as Collection<string, PlayerInGuild>;
	}

	/**
	 * loads the player cache and sorts alphabetically by IGN
	 * @param condition
	 */
	override async loadCache(condition?: FindOptions<Attributes<Player>>) {
		await super.loadCache({
			where: {
				guildId: {
					// player is in a guild or error
					[Op.ne]: null,
				},
			},
			...condition,
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
		if (!player) throw new Error(`[PLAYERS DELETE]: invalid input: ${idOrPlayer}`);

		void player.uncache();
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
	 * @param isAddingSingleEntry whether to call sortAlphabetically() and updateXp() after adding the new entry
	 */
	override async add(options: CreationAttributes<Player>, isAddingSingleEntry = true) {
		const newPlayer = await super.add(options);

		this.client.hypixelGuilds.sweepPlayerCache(newPlayer.guildId);

		if (isAddingSingleEntry) {
			this.sortAlphabetically();

			void newPlayer.updateData({ reason: `joined ${newPlayer.guildName}` });
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

		const { similarity, value } = autocorrect(ign, this.cache, 'ign');

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
	 * uncaches all discord members
	 */
	uncacheDiscordMembers() {
		for (const player of this.cache.values()) {
			void player.setDiscordMember(null, false);
		}
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
		if (this._updateXpPromise) return this._updateXpPromise;

		try {
			return await (this._updateXpPromise = this._updateXp(options));
		} finally {
			this._updateXpPromise = null;
		}
	}
	/**
	 * should only ever be called from within updateXp
	 * @internal
	 */
	private async _updateXp(options?: PlayerUpdateOptions) {
		try {
			// the hypxiel api encountered an error before
			if (this.client.config.get('HYPIXEL_SKYBLOCK_API_ERROR')) {
				// reset error every full hour
				if (new Date().getMinutes() >= this.client.config.get('DATABASE_UPDATE_INTERVAL')) {
					logger.warn('[PLAYERS UPDATE XP]: auto updates disabled');
					return this;
				}

				void this.client.config.set('HYPIXEL_SKYBLOCK_API_ERROR', false);
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
		if (this._updateIgnPromise) return this._updateIgnPromise;

		try {
			return await (this._updateIgnPromise = this._updateIgns());
		} finally {
			this._updateIgnPromise = null;
		}
	}
	/**
	 * should only ever be called from within updateIgns
	 * @internal
	 */
	private async _updateIgns() {
		// the hypxiel api encountered an error before
		if (this.client.config.get('MOJANG_API_ERROR')) {
			// reset error every full hour
			if (new Date().getMinutes() >= this.client.config.get('DATABASE_UPDATE_INTERVAL')) {
				logger.warn('[PLAYERS UPDATE IGNS]: auto updates disabled');
				return this;
			}

			void this.client.config.set('MOJANG_API_ERROR', false);
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
					const { hypixelGuild } = player;

					return log.set(player.guildId, {
						guildName: hypixelGuild?.name ?? player.guildName,
						playerCount: hypixelGuild?.playerCount ?? this.cache.filter(({ guildId: e }) => e === player.guildId).size,
						ignChanges: [`${result.oldIgn} -> ${result.newIgn}`],
					});
				}

				// further change for this guild
				return log.get(player.guildId)!.ignChanges.push(`${result.oldIgn} -> ${result.newIgn}`);
			}),
		);

		// no changes
		if (!log.size) return this;

		// sort cache
		for (const guildId of new Set(log.keys())) {
			this.client.hypixelGuilds.sweepPlayerCache(guildId);
		}
		this.sortAlphabetically();

		// logging
		const embeds: JSONEncodable<APIEmbed>[] = [];

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
			const logParts = splitMessage(codeBlock(ignChanges.sort(compareAlphabetically).join('\n')), {
				maxLength: EMBED_FIELD_MAX_CHARS,
				char: '\n',
				prepend: '```\n',
				append: '```',
			});

			let embed = createEmbed(guildName, playerCount, ignChanges.length);
			let currentLength = embedLength(embed.data);

			while (logParts.length) {
				const name = `${'new ign'.padEnd(150, '\u00A0')}\u200B`;
				const value = logParts.shift()!;

				if (
					currentLength + name.length + value.length <= EMBED_MAX_CHARS &&
					(embed.data.fields?.length ?? 0) < EMBED_MAX_FIELDS
				) {
					embed.addFields([{ name, value }]);
					currentLength += name.length + value.length;
				} else {
					embed = createEmbed(guildName, playerCount, ignChanges.length);
					embed.addFields([{ name, value }]);
					currentLength = embedLength(embed.data);
				}
			}
		}

		void this.client.log(...embeds);

		return this;
	}

	/**
	 * checks all players if their current main profile is still valid
	 */
	async updateMainProfiles() {
		if (this._updateMainProfilesPromise) return this._updateMainProfilesPromise;

		try {
			return await (this._updateMainProfilesPromise = this._updateMainProfiles());
		} finally {
			this._updateMainProfilesPromise = null;
		}
	}
	/**
	 * should only ever be called from within updateMainProfiles
	 * @internal
	 */
	private async _updateMainProfiles() {
		// the hypxiel api encountered an error before
		if (this.client.config.get('HYPIXEL_SKYBLOCK_API_ERROR')) {
			// reset error every full hour
			if (new Date().getMinutes() >= this.client.config.get('DATABASE_UPDATE_INTERVAL')) {
				logger.warn('[PLAYERS UPDATE MAIN PROFILE]: API error');
				return this;
			}

			void this.client.config.set('HYPIXEL_SKYBLOCK_API_ERROR', false);
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
				if (typeof error === 'string') {
					logger.error(`[UPDATE MAIN PROFILE]: ${player.logInfo}: ${error}`);

					const { hypixelGuild } = player;

					if (!log.has(hypixelGuild)) {
						log.set(hypixelGuild, [`-\u00A0${player}: ${error}`]);
						continue;
					}

					log.get(hypixelGuild)!.push(`-\u00A0${player}: ${error}`);
				} else {
					logger.error(error, `[UPDATE MAIN PROFILE]: ${player.logInfo}`);
				}
			}
		}

		if (!log.size) return this;

		const embeds: JSONEncodable<APIEmbed>[] = [];

		/**
		 * @param guild
		 * @param mainProfileChangesAmount
		 */
		const createEmbed = (guild: HypixelGuild, mainProfileChangesAmount: number) => {
			const embed = new EmbedBuilder()
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
			const logParts = splitMessage(codeBlock('diff', mainProfileUpdate.sort(compareAlphabetically).join('\n')), {
				maxLength: EMBED_FIELD_MAX_CHARS,
				char: '\n',
				prepend: '```diff\n',
				append: '```',
			});

			let embed = createEmbed(guild, mainProfileUpdate.length);
			let currentLength = embedLength(embed.data);

			while (logParts.length) {
				const name = `${'main profile update'.padEnd(150, '\u00A0')}\u200B`;
				const value = logParts.shift()!;

				if (
					currentLength + name.length + value.length <= EMBED_MAX_CHARS &&
					(embed.data.fields?.length ?? 0) < EMBED_MAX_FIELDS
				) {
					embed.addFields([{ name, value }]);
					currentLength += name.length + value.length;
				} else {
					embed = createEmbed(guild, mainProfileUpdate.length);
					embed.addFields([{ name, value }]);
					currentLength = embedLength(embed.data);
				}
			}
		}

		void this.client.log(...embeds);

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
	 * @param time last reset config time, defaults to Date.now()
	 */
	async resetXp(options?: ResetXpOptions, time?: number) {
		await safePromiseAll(this.cache.map((player) => player.resetXp(options)));

		if (options?.offsetToReset) {
			void this.client.config.set(
				XP_OFFSETS_TIME[options.offsetToReset as keyof typeof XP_OFFSETS_TIME],
				time ?? Date.now(),
			);
		}

		return this;
	}

	/**
	 * register cron jobs for all xp resets
	 */
	override schedule() {
		const { config } = this.client;

		// auto competition starting
		if (config.get('COMPETITION_SCHEDULED')) {
			const COMPETITION_START = config.get(XP_OFFSETS_TIME[Offset.CompetitionStart]);

			if (COMPETITION_START - seconds(10) > Date.now()) {
				this.client.cronJobs.schedule(
					`${this.constructor.name}:competitionStart`,
					new CronJob({
						cronTime: new Date(COMPETITION_START),
						onTick: () => this._startCompetition(),
					}),
				);
			} else if (!config.get('COMPETITION_RUNNING')) {
				void this._startCompetition();
			}
		}

		// auto competition ending
		const COMPETITION_END = config.get(XP_OFFSETS_TIME[Offset.CompetitionEnd]);

		if (COMPETITION_END - seconds(10) > Date.now()) {
			this.client.cronJobs.schedule(
				`${this.constructor.name}:competitionEnd`,
				new CronJob({
					cronTime: new Date(COMPETITION_END),
					onTick: () => this._endCompetition(),
				}),
			);
		} else if (config.get('COMPETITION_RUNNING')) {
			void this._endCompetition();
		}

		// mayor change reset
		const NEXT_MAYOR_TIME = config.get(XP_OFFSETS_TIME[Offset.Mayor]) + MAYOR_CHANGE_INTERVAL;

		if (NEXT_MAYOR_TIME - seconds(10) > Date.now()) {
			this.client.cronJobs.schedule(
				`${this.constructor.name}:mayorXpReset`,
				new CronJob({
					cronTime: new Date(NEXT_MAYOR_TIME),
					onTick: () => this._performMayorXpReset(),
				}),
			);
		} else {
			void this._performMayorXpReset();
		}

		const now = new Date();

		// daily reset
		if (new Date(config.get(XP_OFFSETS_TIME[Offset.Day])).getUTCDay() !== now.getUTCDay()) {
			void this._performDailyXpReset();
		}

		// each day at 00:00:00
		this.client.cronJobs.schedule(
			`${this.constructor.name}:dailyXpReset`,
			new CronJob({
				cronTime: '0 0 0 * * *',
				timeZone: 'GMT',
				onTick: () => this._performDailyXpReset(),
			}),
		);

		// weekly reset
		if (getWeekOfYear(new Date(config.get(XP_OFFSETS_TIME[Offset.Week]))) !== getWeekOfYear(now)) {
			void this._performWeeklyXpReset();
		}

		// each monday at 00:00:00
		this.client.cronJobs.schedule(
			`${this.constructor.name}:weeklyXpReset`,
			new CronJob({
				cronTime: '0 0 0 * * MON',
				timeZone: 'GMT',
				onTick: () => this._performWeeklyXpReset(),
			}),
		);

		// monthly reset
		if (new Date(config.get(XP_OFFSETS_TIME[Offset.Month])).getUTCMonth() !== now.getUTCMonth()) {
			void this._performMonthlyXpReset();
		}

		// the first of each month at 00:00:00
		this.client.cronJobs.schedule(
			`${this.constructor.name}:monthlyXpReset`,
			new CronJob({
				cronTime: '0 0 0 1 * *',
				timeZone: 'GMT',
				onTick: () => this._performMonthlyXpReset(),
			}),
		);

		return this;
	}

	/**
	 * resets competitionStart xp, updates the config and logs the event
	 */
	private async _startCompetition() {
		await Promise.all([
			this.resetXp({ offsetToReset: Offset.CompetitionStart }),
			this.client.config.set('COMPETITION_RUNNING', true),
			this.client.config.set('COMPETITION_SCHEDULED', false),
		]);

		void this.client.log(
			this.client.defaultEmbed //
				.setTitle('Guild Competition')
				.setDescription('started'),
		);

		return this;
	}

	/**
	 * resets competitionEnd xp, updates the config and logs the event
	 */
	private async _endCompetition() {
		await Promise.all([
			this.resetXp({ offsetToReset: Offset.CompetitionEnd }),
			this.client.config.set('COMPETITION_RUNNING', false),
		]);

		void this.client.log(
			this.client.defaultEmbed //
				.setTitle('Guild Competition')
				.setDescription('ended'),
		);

		return this;
	}

	/**
	 * resets offsetMayor xp, updates the config and logs the event
	 */
	private async _performMayorXpReset() {
		// if the bot skipped a mayor change readd the interval time
		let currentMayorTime = this.client.config.get(XP_OFFSETS_TIME[Offset.Mayor]) + MAYOR_CHANGE_INTERVAL;
		while (currentMayorTime + MAYOR_CHANGE_INTERVAL < Date.now()) currentMayorTime += MAYOR_CHANGE_INTERVAL;

		await this.resetXp({ offsetToReset: Offset.Mayor }, currentMayorTime);

		void this.client.log(
			this.client.defaultEmbed
				.setTitle('Current Mayor XP Tracking')
				.setDescription(`reset the xp gained from ${this.inGuild.size} guild members`),
		);

		this.client.cronJobs.schedule(
			`${this.constructor.name}:mayorXpReset`,
			new CronJob({
				cronTime: new Date(currentMayorTime + MAYOR_CHANGE_INTERVAL),
				onTick: () => this._performMayorXpReset(),
			}),
		);

		return this;
	}

	/**
	 * shifts the daily xp array, updates the config and logs the event
	 */
	private async _performDailyXpReset() {
		await this.resetXp({ offsetToReset: Offset.Day });

		void this.client.log(
			this.client.defaultEmbed
				.setTitle('Daily XP Tracking')
				.setDescription(`reset the xp gained from ${this.inGuild.size} guild members`),
		);

		return this.updateMainProfiles();
	}

	/**
	 * resets offsetWeek xp, updates the config and logs the event
	 */
	private async _performWeeklyXpReset() {
		await this.resetXp({ offsetToReset: Offset.Week });

		void this.client.log(
			this.client.defaultEmbed
				.setTitle('Weekly XP Tracking')
				.setDescription(`reset the xp gained from ${this.inGuild.size} guild members`),
		);

		return this;
	}

	/**
	 * resets offsetMonth xp, updates the config and logs the event
	 */
	private async _performMonthlyXpReset() {
		await this.resetXp({ offsetToReset: Offset.Month });

		void this.client.log(
			this.client.defaultEmbed
				.setTitle('Monthly XP Tracking')
				.setDescription(`reset the xp gained from ${this.inGuild.size} guild members`),
		);

		return this;
	}
}
