import { setTimeout, clearTimeout } from 'node:timers';
import { Model, DataTypes } from 'sequelize';
import { MessageEmbed, Formatters, Util } from 'discord.js';
import { RateLimitError } from '@zikeji/hypixel';
import ms from 'ms';
import { mute, setRank, unmute } from '../../chat_bridge/constants';
import {
	EMBED_FIELD_MAX_CHARS,
	EMBED_MAX_CHARS,
	EMBED_MAX_FIELDS,
	OFFSET_FLAGS,
	SKYBLOCK_XP_TYPES,
	UNKNOWN_IGN,
} from '../../../constants';
import { GuildUtil } from '../../../util';
import { hypixel, mojang } from '../../../api';
import {
	cleanFormattedNumber,
	compareAlphabetically,
	days,
	formatDecimalNumber,
	formatNumber,
	getInlineFieldLineCount,
	hours,
	logger,
	minutes,
	safePromiseAll,
	seconds,
} from '../../../functions';
import type { ModelStatic, Sequelize } from 'sequelize';
import type { Collection, GuildMember, Snowflake } from 'discord.js';
import type { Player } from './Player';
import type { ChatBridge } from '../../chat_bridge/ChatBridge';
import type { LunarClient } from '../../LunarClient';
import type { PREFIX_BY_TYPE } from '../../chat_bridge/constants';

type GuildRank =
	| {
			name: string;
			roleId: null;
			priority: number;
			positionReq: null;
			currentWeightReq: null;
	  }
	| {
			name: string;
			roleId: string;
			priority: number;
			positionReq: number;
			currentWeightReq: number;
	  };

export interface ChatBridgeChannel {
	type: keyof typeof PREFIX_BY_TYPE;
	channelId: Snowflake;
}

interface StatsHistory {
	playerCount: number;
	weightAverage: number;
	skillAverage: number;
	slayerAverage: number;
	catacombsAverage: number;
}

export interface UpdateOptions {
	syncRanks?: boolean;
	rejectOnAPIError?: boolean;
}

interface PlayerWithWeight {
	player: Player;
	weight: number;
}

interface MutedGuildMember {
	minecraftUuid: string;
	mutedTill: number;
}

interface HypixelGuildAttributes {
	guildId: string;
	discordId: Snowflake | null;
	/** Lunar */
	GUILD_ROLE_ID: Snowflake | null;
	EX_GUILD_ROLE_ID: Snowflake | null;
	BRIDGER_ROLE_ID: Snowflake | null;
	staffRoleIds: Snowflake[];
	adminRoleIds: Snowflake[];
	name: string;
	weightReq: number | null;
	chatBridgeEnabled: boolean;
	mutedTill: number;
	_mutedPlayers: MutedGuildMember[];
	chatBridgeChannels: ChatBridgeChannel[];
	ranks: GuildRank[];
	syncRanksEnabled: boolean;
	/** amount of non GM ranks with staff perms */
	staffRanksAmount: number;
	statsHistory: StatsHistory[];
	statDiscordChannels: Record<string, string> | null;
	updateStatDiscordChannelsEnabled: boolean;
	acceptJoinRequests: boolean;
	taxChannelId: Snowflake | null;
	taxMessageId: Snowflake | null;
	announcementsChannelId: Snowflake | null;
	loggingChannelId: Snowflake | null;
	syncIgnThreshold: number;
	kickCooldown: number;
	lastKickAt: Date;
}

export class HypixelGuild extends Model<HypixelGuildAttributes> implements HypixelGuildAttributes {
	declare client: LunarClient;

	declare guildId: string;
	declare discordId: Snowflake | null;
	/** Lunar */
	declare GUILD_ROLE_ID: Snowflake | null;
	declare EX_GUILD_ROLE_ID: Snowflake | null;
	declare BRIDGER_ROLE_ID: Snowflake | null;
	declare staffRoleIds: Snowflake[];
	declare adminRoleIds: Snowflake[];
	declare name: string;
	declare weightReq: number | null;
	declare chatBridgeEnabled: boolean;
	declare mutedTill: number;
	declare _mutedPlayers: MutedGuildMember[];
	declare chatBridgeChannels: ChatBridgeChannel[];
	declare ranks: GuildRank[];
	declare syncRanksEnabled: boolean;
	/** amount of non GM ranks with staff perms */
	declare staffRanksAmount: number;
	declare statsHistory: StatsHistory[];
	declare statDiscordChannels: Record<'weight' | 'skills' | 'slayer' | 'catacombs', string> | null;
	declare updateStatDiscordChannelsEnabled: boolean;
	declare acceptJoinRequests: boolean;
	declare taxChannelId: Snowflake | null;
	declare taxMessageId: Snowflake | null;
	declare announcementsChannelId: Snowflake | null;
	declare loggingChannelId: Snowflake | null;
	declare syncIgnThreshold: number;
	declare kickCooldown: number;
	declare lastKickAt: Date;

	/**
	 * guild ranks sync
	 */
	private _syncRanksPromise: Promise<this> | null = null;
	/**
	 * guild data update
	 */
	private _updateDataPromise: Promise<this> | null = null;
	/**
	 * guild players
	 */
	private _players: Collection<string, Player> | null = null;
	/**
	 * linked chat bridge
	 */
	private _chatBridge: ChatBridge | null = null;
	/**
	 * players who are muted in guild chat, <minecraftUuid, mutedTill>
	 */
	mutedPlayers: Map<string, number>;
	/**
	 * scheduled unmutes
	 */
	private _unmuteTimeouts = new Map<string, NodeJS.Timeout>();

	constructor(...args: any[]) {
		super(...args);

		this.mutedPlayers = new Map(this._mutedPlayers.map(({ minecraftUuid, mutedTill }) => [minecraftUuid, mutedTill]));
	}

	static initialise(sequelize: Sequelize) {
		return this.init(
			{
				guildId: {
					type: DataTypes.STRING,
					primaryKey: true,
				},
				discordId: {
					type: DataTypes.STRING,
					defaultValue: null,
					allowNull: true,
				},
				GUILD_ROLE_ID: {
					type: DataTypes.STRING,
					defaultValue: null,
					allowNull: true,
				},
				EX_GUILD_ROLE_ID: {
					type: DataTypes.STRING,
					defaultValue: null,
					allowNull: true,
				},
				BRIDGER_ROLE_ID: {
					type: DataTypes.STRING,
					defaultValue: null,
					allowNull: true,
				},
				staffRoleIds: {
					type: DataTypes.ARRAY(DataTypes.STRING),
					defaultValue: [],
					allowNull: false,
				},
				adminRoleIds: {
					type: DataTypes.ARRAY(DataTypes.STRING),
					defaultValue: [],
					allowNull: false,
				},
				name: {
					type: DataTypes.STRING,
					defaultValue: 'UNKNOWN_GUILD_NAME',
					allowNull: false,
				},
				weightReq: {
					type: DataTypes.INTEGER,
					defaultValue: 0,
					allowNull: true,
				},
				chatBridgeEnabled: {
					type: DataTypes.BOOLEAN,
					defaultValue: true,
					allowNull: false,
				},
				mutedTill: {
					type: DataTypes.BIGINT,
					defaultValue: 0,
					allowNull: false,
					set(value: number | undefined) {
						this.setDataValue('mutedTill', value ?? 0);
					},
				},
				_mutedPlayers: {
					type: DataTypes.ARRAY(DataTypes.JSONB),
					defaultValue: [],
					allowNull: false,
					set(value: MutedGuildMember[]) {
						this.setDataValue('_mutedPlayers', value);
						(this as HypixelGuild).mutedPlayers = new Map(
							value.map(({ minecraftUuid, mutedTill }) => [minecraftUuid, mutedTill]),
						);
					},
				},
				chatBridgeChannels: {
					type: DataTypes.ARRAY(DataTypes.JSONB),
					defaultValue: [],
					allowNull: false,
				},
				ranks: {
					type: DataTypes.ARRAY(DataTypes.JSONB),
					defaultValue: [],
					allowNull: false,
				},
				syncRanksEnabled: {
					type: DataTypes.BOOLEAN,
					defaultValue: false,
					allowNull: false,
				},
				staffRanksAmount: {
					type: DataTypes.SMALLINT,
					defaultValue: -1, // no staff ranks by default
					allowNull: false,
				},
				statsHistory: {
					type: DataTypes.ARRAY(DataTypes.JSONB),
					defaultValue: Array.from({ length: 30 }).map(() => ({
						playerCount: 0,
						weightAverage: 0,
						skillAverage: 0,
						slayerAverage: 0,
						catacombsAverage: 0,
					})),
					allowNull: false,
				},
				statDiscordChannels: {
					type: DataTypes.JSONB,
					defaultValue: null,
					allowNull: true,
				},
				updateStatDiscordChannelsEnabled: {
					type: DataTypes.BOOLEAN,
					defaultValue: true,
					allowNull: false,
				},
				acceptJoinRequests: {
					type: DataTypes.BOOLEAN,
					defaultValue: false,
					allowNull: false,
				},
				taxChannelId: {
					type: DataTypes.STRING,
					defaultValue: null,
					allowNull: true,
				},
				taxMessageId: {
					type: DataTypes.STRING,
					defaultValue: null,
					allowNull: true,
				},
				announcementsChannelId: {
					type: DataTypes.STRING,
					defaultValue: null,
					allowNull: true,
				},
				loggingChannelId: {
					type: DataTypes.STRING,
					defaultValue: null,
					allowNull: true,
				},
				syncIgnThreshold: {
					type: DataTypes.INTEGER,
					defaultValue: -1,
					allowNull: false,
				},
				kickCooldown: {
					type: DataTypes.INTEGER,
					defaultValue: hours(1),
					allowNull: false,
				},
				lastKickAt: {
					type: DataTypes.DATE,
					defaultValue: new Date(0),
					allowNull: false,
				},
			},
			{
				sequelize,
				timestamps: false,
			},
		) as ModelStatic<HypixelGuild>;
	}

	/**
	 * transformes a log array
	 * @param logArray
	 */
	static transformLogArray(logArray: string[]) {
		if (!logArray.length) return logArray;

		return Util.splitMessage(logArray.sort(compareAlphabetically).join('\n'), {
			maxLength: EMBED_FIELD_MAX_CHARS - 11,
			char: '\n',
		});
	}

	set players(value: Collection<string, Player> | null) {
		this._players = value;
	}

	/**
	 * returns the filtered <LunarClient>.players containing all players from this guild
	 */
	get players(): Collection<string, Player> {
		return (this._players ??= this.client.players.cache.filter(({ guildId }) => guildId === this.guildId));
	}

	set chatBridge(value: ChatBridge | null) {
		this._chatBridge = value;
	}

	/**
	 * returns either the chatBridge if it is linked and ready or throws an exception
	 */
	get chatBridge(): ChatBridge<true> {
		if (!this.chatBridgeEnabled) throw `${this.name}: chat bridge disabled`;
		if (!this._chatBridge?.minecraft.isReady()) {
			throw `${this.name}: chat bridge not ${this._chatBridge ? 'ready' : 'found'}`;
		}
		return this._chatBridge;
	}

	/**
	 * returns the amount of players in the guild
	 */
	get playerCount() {
		return this.players.size;
	}

	/**
	 * returns various average stats
	 */
	get stats() {
		const { players } = this;
		const PLAYER_COUNT = players.size;

		return {
			weightAverage: players.reduce((acc, player) => acc + player.getLilyWeight().totalWeight, 0) / PLAYER_COUNT,
			skillAverage: players.reduce((acc, player) => acc + player.getSkillAverage().skillAverage, 0) / PLAYER_COUNT,
			slayerAverage: players.reduce((acc, player) => acc + player.getSlayerTotal(), 0) / PLAYER_COUNT,
			catacombsAverage:
				players.reduce((acc, player) => acc + player.getSkillLevel('catacombs').nonFlooredLevel, 0) / PLAYER_COUNT,
		};
	}

	/**
	 * returns various average stats, formatted as strings
	 */
	get formattedStats() {
		const formatInteger = (number: number) => cleanFormattedNumber(formatNumber(Math.round(number)));
		const formatDecimal = (number: number) => cleanFormattedNumber(formatDecimalNumber(number));
		const { weightAverage, skillAverage, slayerAverage, catacombsAverage } = this.stats;

		return {
			weight: formatInteger(weightAverage),
			skills: formatDecimal(skillAverage),
			slayer: formatInteger(slayerAverage),
			catacombs: formatDecimal(catacombsAverage),
		};
	}

	/**
	 * wether the player is muted and that mute is not expired
	 */
	get muted() {
		if (this.mutedTill) {
			// mute hasn't expired
			if (Date.now() < this.mutedTill) return true;

			// mute has expired
			this.update({ mutedTill: 0 }).catch((error) => logger.error(error));
		}

		return false;
	}

	/**
	 * linked discord guild (if available)
	 */
	get discordGuild() {
		const discordGuild = this.client.guilds.cache.get(this.discordId!);

		if (discordGuild?.available) return discordGuild;

		if (discordGuild) logger.warn(`[DISCORD GUILD] ${this.name}: unavailable`);
		return null;
	}

	/**
	 * /guild mute ${target} ms(duration)
	 * @param target
	 * @param duration
	 */
	async mute(target: Player | 'everyone', duration: number) {
		// prevent circular calls when syncing
		if (Math.abs(this.mutedPlayers.get((target as Player).minecraftUuid)! - Date.now() - duration) < seconds(1)) return;

		try {
			const { chatBridge } = this;
			return await chatBridge.minecraft.command({
				command: `guild mute ${target} ${ms(duration)}`,
				responseRegExp: mute(`${target}`, chatBridge.bot.username),
			});
		} catch (error) {
			logger.error({ err: error, data: { target: `${target}`, duration } }, `[MUTE]: ${this.name}`);
		}
	}

	/**
	 * /guild unmute ${target}
	 * @param target
	 * @param timeout
	 */
	unmute(target: Player, timeout: number) {
		// prevent circular calls when syncing
		if (!this.checkMute(target)) return;

		// overwrite existing scheduled unmute
		const existing = this._unmuteTimeouts.get(target.minecraftUuid);
		if (existing) {
			clearTimeout(existing);
			this._unmuteTimeouts.delete(target.minecraftUuid);
		}

		// immediate unmute
		if (!timeout) return this._unmute(target);

		// schedule unmute
		return new Promise((resolve) => {
			this._unmuteTimeouts.set(
				target.minecraftUuid,
				setTimeout(() => {
					resolve(this._unmute(target));
				}, timeout),
			);
		});
	}
	/**
	 * @param target
	 * @internal
	 */
	private async _unmute(target: Player) {
		// prevent circular calls when syncing
		if (!this.checkMute(target)) return;

		try {
			const { chatBridge } = this;
			await chatBridge.minecraft.command({
				command: `guild unmute ${target}`,
				responseRegExp: unmute(`${target}`, chatBridge.bot.username),
			});
			this._unmuteTimeouts.delete(target.minecraftUuid);
		} catch (error) {
			logger.error({ err: error, data: { target: `${target}` } }, `[UNMUTE]: ${this.name}`);
			this.unmute(target, minutes(1));
		}
	}

	/**
	 * sync in-game guild mutes for the player
	 * @param player
	 * @param mutedTill
	 */
	syncMute(player: Player, mutedTill: number | null) {
		if (mutedTill == null) {
			// delete returns false if the element has not been deleted, true if it has been deleted
			if (!this.mutedPlayers.delete(player.minecraftUuid)) return;

			const existing = this._unmuteTimeouts.get(player.minecraftUuid);
			if (existing) {
				clearTimeout(existing);
				this._unmuteTimeouts.delete(player.minecraftUuid);
			}

			this._mutedPlayers.splice(
				this._mutedPlayers.findIndex(({ minecraftUuid }) => minecraftUuid === player.minecraftUuid),
				1,
			);

			this.changed('_mutedPlayers', true);

			return this.save().catch((error) =>
				logger.error({ err: error, data: { player: player.ign, mutedTill } }, `[SYNC MUTE]: ${this.name}`),
			);
		}

		this.mutedPlayers.set(player.minecraftUuid, mutedTill);

		const existing = this._mutedPlayers.find(({ minecraftUuid }) => minecraftUuid === player.minecraftUuid);
		if (existing) {
			existing.mutedTill = mutedTill;
		} else {
			this._mutedPlayers.push({ minecraftUuid: player.minecraftUuid, mutedTill });
		}

		this.changed('_mutedPlayers', true);

		return this.save().catch((error) =>
			logger.error({ err: error, data: { player: player.ign, mutedTill } }, `[SYNC MUTE]: ${this.name}`),
		);
	}

	/**
	 * wether the player is muted in-game in this hypixel guild
	 * @param player
	 */
	checkMute(player: Player | null) {
		if (this.mutedPlayers.has(player?.minecraftUuid!)) {
			// mute hasn't expired
			if (Date.now() < this.mutedPlayers.get(player!.minecraftUuid)!) return true;

			// mute has expired
			this.syncMute(player!, null);
		}

		return false;
	}

	/**
	 * removes mutes from players that have expired. useful since the map can still hold mutes of players who left the guild
	 */
	removeExpiredMutes() {
		let changed = false;

		for (const [minecraftUuid, mutedTill] of this.mutedPlayers) {
			if (mutedTill > Date.now()) continue; // not expired yet

			this.mutedPlayers.delete(minecraftUuid);
			this._mutedPlayers.splice(
				this._mutedPlayers.findIndex(({ minecraftUuid: uuid }) => uuid === minecraftUuid),
				1,
			);
			changed = true;
		}

		if (!changed) return;

		this.changed('_mutedPlayers', true);
		return this.save();
	}

	/**
	 * wether the player has an in-game staff rank in this hypixel guild
	 * @param player
	 */
	checkStaff(player: Player) {
		return player.guildId === this.guildId && player.guildRankPriority > this.ranks.length - this.staffRanksAmount;
	}

	/**
	 * shifts the daily stats history
	 */
	saveDailyStats() {
		// append current xp to the beginning of the statsHistory-Array and pop of the last value
		const { statsHistory } = this;
		statsHistory.shift();
		statsHistory.push({ playerCount: this.playerCount, ...this.stats });
		this.changed('statsHistory', true); // neccessary so that sequelize knows an array has changed and the db needs to be updated

		return this.save();
	}

	/**
	 * updates the player database
	 * @param options
	 */
	async updateData(options?: UpdateOptions) {
		if (this._updateDataPromise) return this._updateDataPromise;

		try {
			return await (this._updateDataPromise = this._updateData(options));
		} finally {
			this._updateDataPromise = null;
		}
	}
	/**
	 * should only ever be called from within updateData
	 * @internal
	 */
	private async _updateData({ syncRanks = false, rejectOnAPIError = false }: UpdateOptions = {}) {
		try {
			const {
				meta: { cached },
				name: guildName,
				ranks,
				chatMute,
				members: currentGuildMembers,
			} = await hypixel.guild.id(this.guildId);

			if (cached) {
				logger.info(`[UPDATE GUILD]: ${this.name}: cached data`);
				return this;
			}

			/**
			 * update guild data
			 */

			// update name
			this.name = guildName;

			// update ranks
			for (const { name, priority } of ranks ?? []) {
				const dbEntryRank = this.ranks.find(({ priority: rankPriority }) => rankPriority === priority);

				if (!dbEntryRank) {
					const newRank: GuildRank = {
						name,
						priority,
						roleId: null,
						positionReq: null,
						currentWeightReq: null,
					};

					logger.info(newRank, `[UPDATE GUILD]: ${this.name}: new rank`);
					this.ranks.push(newRank);
					this.ranks.sort(({ priority: a }, { priority: b }) => b - a);
					this.changed('ranks', true);
				} else if (dbEntryRank.name !== name) {
					logger.info(`[UPDATE GUILD]: ${this.name}: rank name changed: '${dbEntryRank.name}' -> '${name}'`);
					dbEntryRank.name = name;
					this.changed('ranks', true);
				}
			}

			// sync guild mutes
			this.mutedTill = chatMute!;

			/**
			 * update guild players
			 */

			if (!currentGuildMembers.length) {
				await this.save();
				throw `[UPDATE GUILD PLAYERS]: ${this.name}: guild data did not include any members`; // API error
			}

			const { players, config } = this.client;
			const guildPlayers = this.players;
			const playersLeft = guildPlayers.filter(
				(_, minecraftUuid) => !currentGuildMembers.some(({ uuid }) => uuid === minecraftUuid),
			);
			const PLAYERS_LEFT_AMOUNT = playersLeft.size;
			const PLAYERS_OLD_AMOUNT = guildPlayers.size;

			// all old players left (???)
			if (PLAYERS_LEFT_AMOUNT && PLAYERS_LEFT_AMOUNT === PLAYERS_OLD_AMOUNT) {
				await this.save();
				throw `[UPDATE GUILD PLAYERS]: ${this.name}: aborting guild player update request due to the possibility of an error from the fetched data`;
			}

			// check if the player is either not in the cache or not in a guild
			const membersJoined = currentGuildMembers.filter(({ uuid }) => !players.cache.get(uuid)?.guildId);

			let leftLog: string[] = [];
			let joinedLog: string[] = [];
			let hasError = false;

			// add / remove player db entries
			await safePromiseAll([
				...membersJoined.map(async ({ uuid: minecraftUuid }) => {
					let player = this.client.players.cache.get(minecraftUuid)!;
					let created = false;

					if (!player) {
						[player, created] = await players.model.findCreateFind({
							where: { minecraftUuid },
							defaults: {
								minecraftUuid,
								guildId: this.guildId,
							},
						});
					}

					let discordMember: GuildMember | null = null;

					// unknown player
					if (created) {
						let ign: string;

						try {
							({ ign } = await mojang.uuid(minecraftUuid));
						} catch (error) {
							logger.error(error, '[GET IGN]');
							ign = UNKNOWN_IGN;
						}

						joinedLog.push(`+\u00A0${ign}`);

						// try to link new player to discord
						let discordTag: string | null = null;

						try {
							discordTag = (await hypixel.player.uuid(minecraftUuid)).socialMedia?.links?.DISCORD ?? null;
						} catch (error) {
							logger.error(error, `[GET DISCORD TAG]: ${ign} (${this.name})`);
						}

						if (discordTag) {
							discordMember = await GuildUtil.fetchMemberByTag(this.discordGuild, discordTag);

							if (!discordMember) {
								joinedLog.push(`-\u00A0${ign}: unknown discord tag ${discordTag}`);
								hasError = true;
							}
						} else {
							joinedLog.push(`-\u00A0${ign}: no linked discord`);
							hasError = true;
						}

						// update player
						setTimeout(async () => {
							try {
								await player.setUniqueDiscordId(discordMember?.id ?? discordTag);
							} catch (error) {
								logger.error(
									{ err: error, toSet: discordMember?.id ?? discordTag, existing: player.discordId },
									`[UPDATE GUILD PLAYERS] ${this.name}`,
								);
							}

							player.update({ ign }).catch((error) => logger.error(error));
							player.updateData({ reason: `joined ${this.name}` });
						}, 0);

						// player already in the db
					} else {
						player
							.update({
								guildId: this.guildId,
								lastActivityAt: new Date(),
							})
							.catch((error) => logger.error(error));

						await player.updateIgn();

						joinedLog.push(`+\u00A0${player}`);

						// try to link new player to discord
						discordMember = await player.fetchDiscordMember(this.discordId);

						if (!discordMember) {
							const discordTag = await player.fetchDiscordTag();

							if (!discordTag) {
								player.inDiscord = false;
								joinedLog.push(`-\u00A0${player}: no linked discord`);
								hasError = true;
							} else {
								discordMember = await GuildUtil.fetchMemberByTag(this.discordGuild, discordTag);

								if (!discordMember) {
									if (/\D/.test(player.discordId!)) {
										try {
											await player.setUniqueDiscordId(discordTag); // save tag if no id is known
										} catch (error) {
											logger.error(
												{ err: error, toSet: discordTag, existing: player.discordId },
												`[UPDATE GUILD PLAYERS] ${this.name}`,
											);
										}
									}

									player.inDiscord = false;
									joinedLog.push(
										player.discordId!.includes('#')
											? `-\u00A0${player}: unknown discord tag ${player.discordId}`
											: `-\u00A0${player}: unknown discord ID ${player.discordId}`,
									);

									hasError = true;
								}
							}
						}

						if (discordMember) player.link(discordMember);

						// update player
						setTimeout(async () => {
							// reset current xp to 0
							await player
								.resetXp({ offsetToReset: OFFSET_FLAGS.CURRENT, typesToReset: SKYBLOCK_XP_TYPES })
								.catch((error) => logger.error(error));

							const XP_LAST_UPDATED_AT = player.xpLastUpdatedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
							// shift the daily array for the amount of daily resets missed
							const DAYS_PASSED_SINCE_LAST_XP_UPDATE = Math.max(
								0,
								Math.min(
									Math.ceil((config.get('LAST_DAILY_XP_RESET_TIME') - XP_LAST_UPDATED_AT) / days(1)),
									player.guildXpHistory.length,
								),
							);

							// to trigger the xp gained reset if global reset happened after the player left the guild
							await safePromiseAll([
								config.get('COMPETITION_START_TIME') >= XP_LAST_UPDATED_AT &&
									player.resetXp({ offsetToReset: OFFSET_FLAGS.COMPETITION_START }),
								config.get('COMPETITION_END_TIME') >= XP_LAST_UPDATED_AT &&
									player.resetXp({ offsetToReset: OFFSET_FLAGS.COMPETITION_END }),
								config.get('LAST_MAYOR_XP_RESET_TIME') >= XP_LAST_UPDATED_AT &&
									player.resetXp({ offsetToReset: OFFSET_FLAGS.MAYOR }),
								config.get('LAST_WEEKLY_XP_RESET_TIME') >= XP_LAST_UPDATED_AT &&
									player.resetXp({ offsetToReset: OFFSET_FLAGS.WEEK }),
								config.get('LAST_MONTHLY_XP_RESET_TIME') >= XP_LAST_UPDATED_AT &&
									player.resetXp({ offsetToReset: OFFSET_FLAGS.MONTH }),
								...Array.from({ length: DAYS_PASSED_SINCE_LAST_XP_UPDATE }).map(() =>
									player.resetXp({ offsetToReset: OFFSET_FLAGS.DAY }),
								),
							]);

							player.updateData({
								reason: `joined ${this.name}`,
							});
						}, 0);
					}

					players.set(minecraftUuid, player);

					// log if a banned player joins (by accident)
					(async () => {
						const existingBan = await this.client.db.models.HypixelGuildBan.findByPk(minecraftUuid);
						if (!existingBan) return;

						this.client.log(
							new MessageEmbed()
								.setColor(this.client.config.get('EMBED_RED'))
								.setAuthor({
									name: discordMember?.user.tag ?? player.ign,
									iconURL: discordMember?.displayAvatarURL(),
									url: player.url,
								})
								.setThumbnail(player.imageURL)
								.setDescription(`${player.info} is on the ban list for \`${existingBan.reason}\``)
								.setTimestamp(),
						);
					})();
				}),

				// player left the guild
				...playersLeft.map(async (player) => {
					leftLog.push(`-\u00A0${player}`);

					if (await player.removeFromGuild()) return; // return if successful

					leftLog.push(`-\u00A0${player}: error updating roles`);
					hasError = true;
				}),
			]);

			// sync guild xp, mutedTill & guild ranks
			const NOW = Date.now();

			for (const hypixelGuildMember of currentGuildMembers) {
				const player = players.cache.get(hypixelGuildMember.uuid);
				if (!player) {
					logger.warn(`[UPDATE GUILD PLAYERS] ${this.name}: missing db entry for uuid: ${hypixelGuildMember.uuid}`);
					continue;
				}

				this.syncMute(player, NOW < (hypixelGuildMember.mutedTill ?? 0) ? hypixelGuildMember.mutedTill! : null);
				player.syncWithGuildData(hypixelGuildMember, this);
			}

			if (syncRanks) this.syncRanks();

			const CHANGES = PLAYERS_LEFT_AMOUNT + membersJoined.length;

			if (!CHANGES) return await this.save();

			players.sortAlphabetically();

			// logging
			joinedLog = HypixelGuild.transformLogArray(joinedLog);
			leftLog = HypixelGuild.transformLogArray(leftLog);

			const EMBED_COUNT = Math.max(joinedLog.length, leftLog.length);
			const loggingEmbeds: MessageEmbed[] = [];
			const createEmbed = () => {
				const embed = new MessageEmbed()
					.setColor(hasError ? config.get('EMBED_RED') : config.get('EMBED_BLUE'))
					.setTitle(`${this.name} Player Database: ${CHANGES} change${CHANGES !== 1 ? 's' : ''}`)
					.setDescription(`Number of players: ${PLAYERS_OLD_AMOUNT} -> ${this.playerCount}`)
					.setTimestamp();

				loggingEmbeds.push(embed);

				return embed;
			};

			let embed = createEmbed();
			let currentLength = embed.length;

			for (let index = 0; index < EMBED_COUNT; ++index) {
				let joinedLogElement = joinedLog[index] ?? '';
				let leftLogElement = leftLog[index] ?? '';

				const IGNS_JOINED_LOG_LINE_COUNT = getInlineFieldLineCount(joinedLogElement, 28);
				const PLAYERS_LEFT_LOG_LINE_COUNT = getInlineFieldLineCount(leftLogElement, 28);
				const MAX_VALUE_LINES = Math.max(IGNS_JOINED_LOG_LINE_COUNT, PLAYERS_LEFT_LOG_LINE_COUNT);

				// // empty line padding
				for (let i = 1 + MAX_VALUE_LINES - IGNS_JOINED_LOG_LINE_COUNT; --i; ) joinedLogElement += '\n\u200B';
				for (let i = 1 + MAX_VALUE_LINES - PLAYERS_LEFT_LOG_LINE_COUNT; --i; ) leftLogElement += '\n\u200B';

				const newFields = [
					{
						name: `${'joined'.padEnd(125, '\u00A0')}\u200B`,
						value: Formatters.codeBlock('diff', joinedLogElement),
						inline: true,
					},
					{
						name: `${'left'.padEnd(125, '\u00A0')}\u200B`,
						value: Formatters.codeBlock('diff', leftLogElement),
						inline: true,
					},
					{
						name: '\u200B',
						value: '\u200B',
						inline: true,
					},
				];
				const ADDITIONAL_LENGTH = newFields.reduce((acc, { name, value }) => acc + name.length + value.length, 0);

				if (currentLength + ADDITIONAL_LENGTH <= EMBED_MAX_CHARS && embed.fields.length < EMBED_MAX_FIELDS) {
					embed.addFields(...newFields);
					currentLength += ADDITIONAL_LENGTH;
				} else {
					embed = createEmbed();
					embed.addFields(...newFields);
					currentLength = embed.length;
				}
			}

			this.client.log(...loggingEmbeds);
			return await this.save();
		} catch (error) {
			if (typeof error === 'string') {
				logger.error(`[UPDATE DATA]: ${this.name}: ${error}`);
				return this;
			}
			if (
				(error instanceof Error && error.name.startsWith('Sequelize')) ||
				error instanceof TypeError ||
				error instanceof RangeError
			) {
				logger.error(error, `[UPDATE DATA]: ${this.name}`);
				return this;
			}

			logger.error(error, `[UPDATE DATA]: ${this.name}`);
			if (!(error instanceof RateLimitError)) this.client.config.set('HYPIXEL_API_ERROR', true);
			if (rejectOnAPIError) throw error;
			return this;
		}
	}

	/**
	 * syncs guild ranks with the weight leaderboard
	 */
	async syncRanks() {
		if (!this.client.config.get('AUTO_GUILD_RANKS') || !this.syncRanksEnabled) return this;

		if (this._syncRanksPromise) return this._syncRanksPromise;

		try {
			return await (this._syncRanksPromise = this._syncRanks());
		} finally {
			this._syncRanksPromise = null;
		}
	}
	/**
	 * should only ever be called from within syncRanks
	 * @internal
	 */
	private async _syncRanks() {
		try {
			const nonStaffWithWeight: PlayerWithWeight[] = [];

			// calculate weight for non-staff members and their amount
			for (const player of this.players.values()) {
				if (this.checkStaff(player)) continue;

				nonStaffWithWeight.push({
					player,
					weight: player.getLilyWeight().totalWeight,
				});
			}

			nonStaffWithWeight.sort(({ weight: a }, { weight: b }) => a - b);

			// abort if a player's weight is 0 -> most likely an API error
			if (!nonStaffWithWeight[0]?.weight) {
				logger.error(
					`[SYNC GUILD RANKS] ${this.name}: ${
						nonStaffWithWeight.length ? `${nonStaffWithWeight[0].player.ign}'s weight is 0` : 'no non-staff players'
					}`,
				);
				return this;
			}

			/** ranks with an absolute instead of a relative positionReq, sorted descendingly by it */
			const automatedRanks = this.ranks
				.flatMap((rank) => {
					if (rank.positionReq == null) return [];

					const positionReq = Math.round(rank.positionReq * nonStaffWithWeight.length);
					const playerAtReq = nonStaffWithWeight[positionReq];

					if (!playerAtReq) return [];

					// update 'currentWeightReq' (1/2)
					rank.currentWeightReq = Math.ceil(playerAtReq.weight);

					return {
						...rank,
						positionReq,
					};
				})
				.sort(({ positionReq: a }, { positionReq: b }) => b - a);

			// no ranks with a positionReq
			if (!automatedRanks.length) return this;

			// update 'currentWeightReq' (2/2)
			this.changed('ranks', true);
			this.save().catch((error) => logger.error(error));

			// update player ranks
			if (!this.chatBridgeEnabled) return this;

			const { chatBridge } = this;
			const setRankLog: MessageEmbed[] = [];

			for (const [index, { player }] of nonStaffWithWeight.entries()) {
				// automatedRanks is sorted descendingly by positionReq
				const newRank = automatedRanks.find(({ positionReq }) => index >= positionReq)!;

				// player already has the correct rank
				if (player.guildRankPriority === newRank.priority) continue;

				const OLD_RANK_NAME = player.guildRank?.name;

				// set player to the correct rank
				await chatBridge.minecraft.command({
					command: `g setrank ${player} ${newRank.name}`,
					responseRegExp: setRank(player.ign, OLD_RANK_NAME, newRank.name),
					rejectOnTimeout: true,
				});

				setRankLog.push(
					this.client.defaultEmbed
						.setThumbnail(player.imageURL)
						.setDescription(`${Formatters.bold('Auto Rank Sync')} for ${player.info}`)
						.addFields(
							{
								name: 'Old',
								value: OLD_RANK_NAME ?? 'unknown',
								inline: true,
							},
							{
								name: 'New',
								value: newRank.name,
								inline: true,
							},
						),
				);
			}

			this.client.log(...setRankLog);
			return this;
		} catch (error) {
			logger.error(error, '[SYNC GUILD RANKS]');
			return this;
		}
	}

	/**
	 * update discord stat channel names
	 */
	async updateStatDiscordChannels() {
		if (!this.updateStatDiscordChannelsEnabled || !this.statDiscordChannels) return;

		for (const [type, value] of Object.entries(this.formattedStats)) {
			const channel = this.client.channels.cache.get(
				this.statDiscordChannels[type as keyof HypixelGuild['formattedStats']],
			);

			if (!channel?.isVoice()) {
				// no channel found
				logger.warn(`[GUILD STATS CHANNEL UPDATE] ${this.name}: ${type}: no channel found`);
				continue;
			}

			const newName = `${type}︱${value}`;
			const { name: oldName } = channel;

			if (newName === oldName) continue; // no update needed

			if (!channel.manageable) {
				logger.error(`[GUILD STATS CHANNEL UPDATE] ${this.name}: ${channel.name}: missing permissions to edit`);
				continue;
			}

			await channel.setName(newName, `synced with ${this.name}'s average stats`);

			logger.info(`[GUILD STATS CHANNEL UPDATE] ${this.name}: '${oldName}' -> '${newName}'`);
		}
	}

	/**
	 * the name of the guild
	 */
	override toString() {
		return this.name;
	}
}

export default HypixelGuild;
