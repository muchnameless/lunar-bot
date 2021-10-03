import { GuildMember, MessageEmbed, Permissions, Formatters } from 'discord.js';
import pkg from 'sequelize';
const { Model, DataTypes } = pkg;
import { stripIndents } from 'common-tags';
import { RateLimitError } from '@zikeji/hypixel';
import {
	CATACOMBS_ROLES,
	COSMETIC_SKILLS,
	DELIMITER_ROLES,
	DUNGEON_CLASSES,
	DUNGEON_TYPES,
	DUNGEON_TYPES_AND_CLASSES,
	GUILD_ID_BRIDGER,
	GUILD_ID_ERROR,
	NICKNAME_MAX_CHARS,
	OFFSET_FLAGS,
	SKILL_ACHIEVEMENTS,
	SKILL_AVERAGE_ROLES,
	SKILL_ROLES,
	SKILL_XP_TOTAL,
	SKILLS,
	SLAYER_ROLES,
	SLAYER_TOTAL_ROLES,
	SLAYER_XP,
	SLAYERS,
	UNKNOWN_IGN,
	XP_OFFSETS,
	XP_TYPES,
} from '../../../constants';
import { HypixelGuildManager } from '../managers/HypixelGuildManager';
import { GuildMemberUtil, GuildUtil, MessageEmbedUtil, UserUtil } from '../../../util';
import { hypixel } from '../../../api/hypixel';
import { mojang } from '../../../api/mojang';
import {
	escapeIgn,
	getSenitherDungeonWeight,
	getSenitherSkillWeight,
	getSenitherSlayerWeight,
	getSenitherWeight,
	getSkillLevel,
	logger,
	mutedCheck,
	trim,
	uuidToImgurBustURL,
	validateDiscordId,
	validateNumber,
} from '../../../functions';
import type { ModelStatic, Optional, Sequelize } from 'sequelize';
import type { Snowflake } from 'discord.js';
import type { Components } from '@zikeji/hypixel';
import type { SkyBlockProfile } from '../../../api/hypixel';
import type { HypixelGuild } from './HypixelGuild';
import type { Transaction, TransactionAttributes } from './Transaction';
import type { LunarClient } from '../../LunarClient';
import type { TaxCollector } from './TaxCollector';
import type { ModelResovable } from '../managers/ModelManager';
import type { DungeonTypes, SkillTypes, SlayerTypes, XPOffsets, XPTypes } from '../../../constants';
import type { RoleResolvables } from '../../../util/GuildUtil';


interface ParsedTransaction extends TransactionAttributes {
	fromIGN: string | null;
	toIGN: string | null;
}

export interface PlayerUpdateOptions {
	/** role update reason for discord's audit logs */
	reason?: string;
	/** wether to dm the user that they should include their ign somewhere in their nickname */
	shouldSendDm?: boolean;
	/** wether to only await the updateXp call and not updateDiscordMember */
	shouldOnlyAwaitUpdateXp?: boolean;
	/** wether to reject if the hypixel API reponded with an error */
	rejectOnAPIError?: boolean;
}

export interface TransferXpOptions {
	from?: XPOffsets;
	to?: XPOffsets;
	types?: readonly XPTypes[];
}

export interface ResetXpOptions {
	offsetToReset?: XPOffsets | null | typeof OFFSET_FLAGS.DAY | typeof OFFSET_FLAGS.CURRENT;
	typesToReset?: readonly XPTypes[];
}

interface SetToPaidOptions {
	/** paid amount */
	amount?: number;
	/** minecraft uuid of the player who collected */
	collectedBy?: ModelResovable<TaxCollector>;
	/** hypixel auction uuid */
	auctionId?: string | null;
}

interface AddTransferOptions extends SetToPaidOptions {
	collectedBy: ModelResovable<TaxCollector>;
	amount: number;
	notes?: string | null;
	type?: 'tax' | 'donation';
}

interface PlayerAttributes {
	minecraftUuid: string;
	ign: string;
	discordId: Snowflake | null;
	guildId: string | null;
	guildRankPriority: number;
	inDiscord: boolean;
	mutedTill: number;
	_infractions: number[] | null;
	hasDiscordPingPermission: boolean;
	notes: string | null;
	paid: boolean;
	mainProfileId: string | null;
	mainProfileName: string | null;
	xpLastUpdatedAt: number | null;
	xpUpdatesDisabled: boolean;
	discordMemberUpdatesDisabled: boolean;
	farmingLvlCap: number;
	guildXpDay: string | null;
	guildXpDaily: number;
}

type PlayerCreationAttributes = Optional<PlayerAttributes, 'ign' | 'discordId' | 'guildId' | 'guildRankPriority' | 'inDiscord' | 'mutedTill' | '_infractions' | 'hasDiscordPingPermission' | 'notes' | 'paid' | 'mainProfileId' | 'mainProfileName' | 'xpLastUpdatedAt' | 'xpUpdatesDisabled' | 'discordMemberUpdatesDisabled' | 'farmingLvlCap' | 'guildXpDay' | 'guildXpDaily'>;

interface PlayerInGuild extends Player {
	hypixelGuild: HypixelGuild;
	guildId: string;
}

const enum NickChangeReason {
	NO_IGN,
	NOT_UNIQUE,
}


export class Player extends Model<PlayerAttributes, PlayerCreationAttributes> implements PlayerAttributes {
	declare client: LunarClient;

	declare minecraftUuid: string;
	declare ign: string;
	declare discordId: string | null;
	declare guildId: string | null;
	declare guildRankPriority: number;
	declare inDiscord: boolean;
	declare mutedTill: number;
	declare _infractions: number[] | null;
	declare hasDiscordPingPermission: boolean;
	declare notes: string | null;
	declare paid: boolean;
	declare mainProfileId: string | null;
	declare mainProfileName: string | null;
	declare xpLastUpdatedAt: number | null;
	declare xpUpdatesDisabled: boolean;
	declare discordMemberUpdatesDisabled: boolean;
	declare farmingLvlCap: number;
	declare guildXpDay: string | null;
	declare guildXpDaily: number;

	declare tamingXp: number;
	declare farmingXp: number;
	declare miningXp: number;
	declare combatXp: number;
	declare foragingXp: number;
	declare fishingXp: number;
	declare enchantingXp: number;
	declare alchemyXp: number;
	declare carpentryXp: number;
	declare runecraftingXp: number;
	declare zombieXp: number;
	declare spiderXp: number;
	declare wolfXp: number;
	declare endermanXp: number;
	declare catacombsXp: number;
	declare healerXp: number;
	declare mageXp: number;
	declare berserkXp: number;
	declare archerXp: number;
	declare tankXp: number;
	declare guildXp: number;

	declare tamingXpHistory: number[];
	declare farmingXpHistory: number[];
	declare miningXpHistory: number[];
	declare combatXpHistory: number[];
	declare foragingXpHistory: number[];
	declare fishingXpHistory: number[];
	declare enchantingXpHistory: number[];
	declare alchemyXpHistory: number[];
	declare carpentryXpHistory: number[];
	declare runecraftingXpHistory: number[];
	declare zombieXpHistory: number[];
	declare spiderXpHistory: number[];
	declare wolfXpHistory: number[];
	declare endermanXpHistory: number[];
	declare catacombsXpHistory: number[];
	declare healerXpHistory: number[];
	declare mageXpHistory: number[];
	declare berserkXpHistory: number[];
	declare archerXpHistory: number[];
	declare tankXpHistory: number[];
	declare guildXpHistory: number[];

	declare tamingXpCompetitionStart: number;
	declare farmingXpCompetitionStart: number;
	declare miningXpCompetitionStart: number;
	declare combatXpCompetitionStart: number;
	declare foragingXpCompetitionStart: number;
	declare fishingXpCompetitionStart: number;
	declare enchantingXpCompetitionStart: number;
	declare alchemyXpCompetitionStart: number;
	declare carpentryXpCompetitionStart: number;
	declare runecraftingXpCompetitionStart: number;
	declare zombieXpCompetitionStart: number;
	declare spiderXpCompetitionStart: number;
	declare wolfXpCompetitionStart: number;
	declare endermanXpCompetitionStart: number;
	declare catacombsXpCompetitionStart: number;
	declare healerXpCompetitionStart: number;
	declare mageXpCompetitionStart: number;
	declare berserkXpCompetitionStart: number;
	declare archerXpCompetitionStart: number;
	declare tankXpCompetitionStart: number;
	declare guildXpCompetitionStart: number;

	declare tamingXpCompetitionEnd: number;
	declare farmingXpCompetitionEnd: number;
	declare miningXpCompetitionEnd: number;
	declare combatXpCompetitionEnd: number;
	declare foragingXpCompetitionEnd: number;
	declare fishingXpCompetitionEnd: number;
	declare enchantingXpCompetitionEnd: number;
	declare alchemyXpCompetitionEnd: number;
	declare carpentryXpCompetitionEnd: number;
	declare runecraftingXpCompetitionEnd: number;
	declare zombieXpCompetitionEnd: number;
	declare spiderXpCompetitionEnd: number;
	declare wolfXpCompetitionEnd: number;
	declare endermanXpCompetitionEnd: number;
	declare catacombsXpCompetitionEnd: number;
	declare healerXpCompetitionEnd: number;
	declare mageXpCompetitionEnd: number;
	declare berserkXpCompetitionEnd: number;
	declare archerXpCompetitionEnd: number;
	declare tankXpCompetitionEnd: number;
	declare guildXpCompetitionEnd: number;

	declare tamingXpOffsetMayor: number;
	declare farmingXpOffsetMayor: number;
	declare miningXpOffsetMayor: number;
	declare combatXpOffsetMayor: number;
	declare foragingXpOffsetMayor: number;
	declare fishingXpOffsetMayor: number;
	declare enchantingXpOffsetMayor: number;
	declare alchemyXpOffsetMayor: number;
	declare carpentryXpOffsetMayor: number;
	declare runecraftingXpOffsetMayor: number;
	declare zombieXpOffsetMayor: number;
	declare spiderXpOffsetMayor: number;
	declare wolfXpOffsetMayor: number;
	declare endermanXpOffsetMayor: number;
	declare catacombsXpOffsetMayor: number;
	declare healerXpOffsetMayor: number;
	declare mageXpOffsetMayor: number;
	declare berserkXpOffsetMayor: number;
	declare archerXpOffsetMayor: number;
	declare tankXpOffsetMayor: number;
	declare guildXpOffsetMayor: number;

	declare tamingXpOffsetWeek: number;
	declare farmingXpOffsetWeek: number;
	declare miningXpOffsetWeek: number;
	declare combatXpOffsetWeek: number;
	declare foragingXpOffsetWeek: number;
	declare fishingXpOffsetWeek: number;
	declare enchantingXpOffsetWeek: number;
	declare alchemyXpOffsetWeek: number;
	declare carpentryXpOffsetWeek: number;
	declare runecraftingXpOffsetWeek: number;
	declare zombieXpOffsetWeek: number;
	declare spiderXpOffsetWeek: number;
	declare wolfXpOffsetWeek: number;
	declare endermanXpOffsetWeek: number;
	declare catacombsXpOffsetWeek: number;
	declare healerXpOffsetWeek: number;
	declare mageXpOffsetWeek: number;
	declare berserkXpOffsetWeek: number;
	declare archerXpOffsetWeek: number;
	declare tankXpOffsetWeek: number;
	declare guildXpOffsetWeek: number;

	declare tamingXpOffsetMonth: number;
	declare farmingXpOffsetMonth: number;
	declare miningXpOffsetMonth: number;
	declare combatXpOffsetMonth: number;
	declare foragingXpOffsetMonth: number;
	declare fishingXpOffsetMonth: number;
	declare enchantingXpOffsetMonth: number;
	declare alchemyXpOffsetMonth: number;
	declare carpentryXpOffsetMonth: number;
	declare runecraftingXpOffsetMonth: number;
	declare zombieXpOffsetMonth: number;
	declare spiderXpOffsetMonth: number;
	declare wolfXpOffsetMonth: number;
	declare endermanXpOffsetMonth: number;
	declare catacombsXpOffsetMonth: number;
	declare healerXpOffsetMonth: number;
	declare mageXpOffsetMonth: number;
	declare berserkXpOffsetMonth: number;
	declare archerXpOffsetMonth: number;
	declare tankXpOffsetMonth: number;
	declare guildXpOffsetMonth: number;

	declare readonly createdAt: Date;
	declare readonly updatedAt: Date;

	/**
	 * linked guild member
	 */
	#discordMember: GuildMember | null = null;

	static initialize(sequelize: Sequelize) {
		const attributes = {};

		// add xp types
		for (const type of XP_TYPES) {
			Reflect.set(attributes, `${type}Xp`, {
				type: DataTypes.DECIMAL,
				defaultValue: 0,
				allowNull: false,
			});

			Reflect.set(attributes, `${type}XpHistory`, {
				type: DataTypes.ARRAY(DataTypes.DECIMAL),
				defaultValue: Array.from({ length: 30 }).fill(0),
				allowNull: false,
			});

			for (const offset of XP_OFFSETS) {
				Reflect.set(attributes, `${type}Xp${offset}`, {
					type: DataTypes.DECIMAL,
					defaultValue: 0,
					allowNull: false,
				});
			}
		}

		return this.init({
			// general information
			minecraftUuid: {
				type: DataTypes.STRING,
				primaryKey: true,
			},
			ign: {
				type: DataTypes.STRING,
				defaultValue: UNKNOWN_IGN,
				allowNull: false,
			},
			discordId: {
				type: DataTypes.STRING,
				defaultValue: null,
				allowNull: true,
				set(value: Snowflake | null) {
					if (!value) (this as Player).inDiscord = false;
					this.setDataValue('discordId', value);
				},
			},
			guildId: {
				type: DataTypes.STRING,
				defaultValue: null,
				allowNull: true,
			},
			guildRankPriority: {
				type: DataTypes.INTEGER,
				defaultValue: 0,
				allowNull: false,
			},
			inDiscord: {
				type: DataTypes.BOOLEAN,
				defaultValue: false,
				allowNull: false,
				set(value: boolean) {
					if (!value) (this as Player).uncacheMember();
					this.setDataValue('inDiscord', value);
				},
			},
			mutedTill: {
				type: DataTypes.BIGINT,
				defaultValue: 0,
				allowNull: false,
				set(value: number | undefined) {
					this.setDataValue('mutedTill', value ?? 0);
				},
			},
			_infractions: {
				type: DataTypes.ARRAY(DataTypes.BIGINT),
				defaultValue: null,
				allowNull: true,
			},
			hasDiscordPingPermission: {
				type: DataTypes.BOOLEAN,
				defaultValue: true,
				allowNull: false,
			},
			notes: {
				type: DataTypes.TEXT,
				defaultValue: null,
				allowNull: true,
			},

			// tax stats
			paid: {
				type: DataTypes.BOOLEAN,
				defaultValue: false,
				allowNull: false,
			},

			// xp stats reference
			mainProfileId: {
				type: DataTypes.STRING,
				defaultValue: null,
				allowNull: true,
			},
			mainProfileName: {
				type: DataTypes.STRING,
				defaultValue: null,
				allowNull: true,
			},
			xpLastUpdatedAt: {
				type: DataTypes.BIGINT,
				defaultValue: null,
				allowNull: true,
			},
			xpUpdatesDisabled: {
				type: DataTypes.BOOLEAN,
				defaultValue: false,
				allowNull: false,
			},
			discordMemberUpdatesDisabled: {
				type: DataTypes.BOOLEAN,
				defaultValue: false,
				allowNull: false,
			},

			// Individual Max Lvl Cap
			farmingLvlCap: {
				type: DataTypes.INTEGER,
				defaultValue: 50,
				allowNull: false,
			},

			// hypixel guild exp
			guildXpDay: {
				type: DataTypes.STRING,
				defaultValue: null,
				allowNull: true,
			},
			guildXpDaily: {
				type: DataTypes.INTEGER,
				defaultValue: 0,
				allowNull: false,
			},

			...attributes,
		}, {
			sequelize,
			modelName: 'Player',
			indexes: [{ // setting unique down here works with `sync --alter`
				unique: true,
				fields: [ 'discordId' ],
			}],
		}) as ModelStatic<Player>;
	}

	/**
	 * returns the number of infractions that have not already expired
	 */
	get infractions() {
		if (!this._infractions) return 0;

		// last infraction expired -> remove all infractions
		if (this._infractions.at(-1)! + this.client.config.get('INFRACTIONS_EXPIRATION_TIME') <= Date.now()) {
			this._infractions = null;
			this.save();
			return 0;
		}

		return this._infractions.length;
	}

	/**
	 * returns the hypixel guild db object associated with the player
	 */
	get hypixelGuild(): HypixelGuild | null {
		if (this.guildId !== GUILD_ID_BRIDGER) {
			return this.client.hypixelGuilds.cache.get(this.guildId!)
				?? logger.warn(`[GET GUILD]: ${this.ign}: no guild with the id '${this.guildId}' found`);
		}

		return this.client.hypixelGuilds.mainGuild ?? null;
	}

	/**
	 * wether the player is actually in a guild and not just one of PSEUDO_GUILD_IDS
	 */
	inGuild(): this is PlayerInGuild {
		return !HypixelGuildManager.PSEUDO_GUILD_IDS.includes(this.guildId as any);
	}

	/**
	 * fetches the discord member if the discord id is valid and the player is in lg discord
	 */
	// @ts-expect-error The return type of a 'get' accessor must be assignable to its 'set' accessor type
	get discordMember(): Promise<GuildMember | null> {
		return (async () => {
			if (this.#discordMember) return this.#discordMember;
			if (!this.inDiscord || !validateDiscordId(this.discordId!)) return null;

			try {
				return this.discordMember = await this.client.lgGuild?.members.fetch(this.discordId!) ?? null;
			} catch (error) {
				this.inDiscord = false; // prevent further fetches and try to link via cache in the next updateDiscordMember calls
				this.save();
				logger.error(`[GET DISCORD MEMBER]: ${this.logInfo}`, error);
				return this.#discordMember = null;
			}
		})();
	}

	/**
	 * @param member discord guild member linked to the player
	 */
	set discordMember(member: GuildMember | null) {
		if (member == null) {
			this.update({ inDiscord: false }).catch(logger.error);
			return;
		}

		this.#discordMember = member;

		if (this.inDiscord) return;

		this.update({ inDiscord: true }).catch(logger.error);
	}

	/**
	 * fetches the discord user if the discord id is valid
	 */
	get discordUser() {
		return validateNumber(this.discordId)
			? this.client.users.fetch(this.discordId)
			: Promise.resolve(null);
	}

	/**
	 * returns the guild rank of the player
	 */
	get guildRank() {
		return this.hypixelGuild?.ranks?.find(({ priority }) => priority === this.guildRankPriority) ?? null;
	}

	/**
	 * returns the player's guild name
	 */
	get guildName() {
		switch (this.guildId) {
			case GUILD_ID_BRIDGER:
				return 'Bridger';

			case GUILD_ID_ERROR:
				return 'Error';

			default:
				return this.hypixelGuild?.name ?? 'unknown guild';
		}
	}

	/**
	 * returns a string with the ign and guild name
	 */
	get info() {
		return `${Formatters.hyperlink(escapeIgn(this.ign), this.url)} | ${this.guildName}`; // •
	}

	/**
	 * returns a string with the ign and guild name
	 */
	get logInfo() {
		return `${this.ign} (${this.guildName})`;
	}

	/**
	 * imgur link with a bust url of the player's skin
	 */
	get imageURL() {
		return uuidToImgurBustURL(this.minecraftUuid);
	}

	/**
	 * returns a sky.shiiyu.moe link for the player
	 */
	get url() {
		return `https://sky.shiiyu.moe/stats/${this.ign !== UNKNOWN_IGN ? this.ign : this.minecraftUuid}/${this.mainProfileName ?? ''}`;
	}

	/**
	 * wether the player has an in game staff rank,
	 * assumes the last two guild ranks are staff ranks
	 */
	get isStaff() {
		return this.guildRankPriority >= this.hypixelGuild?.ranks.length! - 1;
	}

	/**
	 * amount of the last tax transaction from that player
	 */
	get taxAmount() {
		return (async () => {
			const result = await this.client.db.models.Transaction.findAll({
				limit: 1,
				where: {
					from: this.minecraftUuid,
					type: 'tax',
				},
				order: [ [ 'createdAt', 'DESC' ] ],
				attributes: [ 'amount' ],
				raw: true,
			});

			return result.length
				? result[0].amount
				: null;
		})();
	}

	/**
	 * all transactions from that player
	 */
	get transactions(): Promise<ParsedTransaction[]> {
		return (async () => Promise.all(
			(await this.client.db.models.Transaction.findAll({
				where: {
					from: this.minecraftUuid,
				},
				order: [ [ 'createdAt', 'DESC' ] ],
				raw: true,
			}))
				.map(async transaction => ({
					...transaction,
					fromIGN: this.ign,
					toIGN: (this.client.players.cache.get(transaction.to) ?? await mojang.uuid(transaction.to).catch(logger.error))?.ign ?? transaction.to,
				})),
		))();
	}

	/**
	 * wether the player is muted and that mute is not expired
	 */
	get muted() {
		return mutedCheck(this);
	}

	/**
	 * updates the player data and discord member
	 * @param options
	 */
	async updateData({ reason = 'synced with in game stats', shouldSendDm = false, shouldOnlyAwaitUpdateXp = false, rejectOnAPIError = false }: PlayerUpdateOptions = {}) {
		if (this.guildId === GUILD_ID_BRIDGER) return;
		if (this.guildId !== GUILD_ID_ERROR) await this.updateXp(rejectOnAPIError); // only query hypixel skyblock api for guild players without errors

		if (shouldOnlyAwaitUpdateXp) {
			this.updateDiscordMember({ reason, shouldSendDm });
		} else {
			await this.updateDiscordMember({ reason, shouldSendDm });
		}
	}

	/**
	 * updates skill and slayer xp
	 * @param rejectOnAPIError
	 */
	async updateXp(rejectOnAPIError = false) {
		if (this.xpUpdatesDisabled) return;

		try {
			if (!this.mainProfileId) await this.fetchMainProfile(); // detect main profile if it is unknown

			// hypixel API call
			const playerData = (await hypixel.skyblock.profile(this.mainProfileId!))?.members?.[this.minecraftUuid];

			if (!playerData) {
				this.mainProfileId = null;
				this.save();
				throw `unable to find main profile named '${this.mainProfileName}' -> resetting name`;
			}

			this.xpLastUpdatedAt = Date.now();

			/**
			 * SKILLS
			 */
			if (Reflect.has(playerData, 'experience_skill_alchemy')) {
				for (const skill of SKILLS) this[`${skill}Xp`] = playerData[`experience_skill_${skill}`] ?? 0;
				for (const skill of COSMETIC_SKILLS) this[`${skill}Xp`] = playerData[`experience_skill_${skill}`] ?? 0;

				// reset skill xp if no taming xp offset
				if (this.tamingXp !== 0) {
					for (const offset of XP_OFFSETS) {
						if (this[`tamingXp${offset}`] === 0) {
							logger.info(`[UPDATE XP]: ${this.logInfo}: resetting '${offset}' skill xp`);
							await this.resetXp({ offsetToReset: offset, typesToReset: [ ...SKILLS, ...COSMETIC_SKILLS ] });
						}
					}
				}
			} else {
				// log once every hour (during the first update)
				if (!(new Date().getHours() % 6) && new Date().getMinutes() < this.client.config.get('DATABASE_UPDATE_INTERVAL')) {
					logger.warn(`[UPDATE XP]: ${this.logInfo}: skill API disabled`);
				}

				this.notes = 'skill api disabled';

				/**
				 * request achievements api
				 */
				const { achievements } = await hypixel.player.uuid(this.minecraftUuid);

				for (const skill of SKILLS) this[`${skill}Xp`] = SKILL_XP_TOTAL[achievements?.[SKILL_ACHIEVEMENTS[skill]] ?? 0] ?? 0;
			}

			// @ts-expect-error jacob2 is not updated
			this.farmingLvlCap = 50 + (playerData.jacob2?.perks?.farming_level_cap ?? 0);

			/**
			 * slayer
			 */
			for (const slayer of SLAYERS) this[`${slayer}Xp`] = playerData.slayer_bosses?.[slayer]?.xp ?? 0;

			// reset slayer xp if no zombie xp offset
			if (this.zombieXp !== 0) {
				for (const offset of XP_OFFSETS) {
					if (this[`zombieXp${offset}`] === 0) {
						logger.info(`[UPDATE XP]: ${this.logInfo}: resetting '${offset}' slayer xp`);
						await this.resetXp({ offsetToReset: offset, typesToReset: SLAYERS });
					}
				}
			}

			// no slayer data found logging
			if (!Reflect.has(playerData.slayer_bosses?.zombie ?? {}, 'xp') && !(new Date().getHours() % 6) && new Date().getMinutes() < this.client.config.get('DATABASE_UPDATE_INTERVAL')) {
				logger.warn(`[UPDATE XP]: ${this.logInfo}: no slayer data found`);
			}

			/**
			 * dungeons
			 */
			for (const dungeonType of DUNGEON_TYPES) this[`${dungeonType}Xp`] = playerData.dungeons?.dungeon_types?.[dungeonType]?.experience ?? 0;
			for (const dungeonClass of DUNGEON_CLASSES) this[`${dungeonClass}Xp`] = playerData.dungeons?.player_classes?.[dungeonClass]?.experience ?? 0;

			// reset dungeons xp if no catacombs xp offset
			if (this.catacombsXp !== 0) {
				for (const offset of XP_OFFSETS) {
					if (this[`catacombsXp${offset}`] === 0) {
						logger.info(`[UPDATE XP]: ${this.logInfo}: resetting '${offset}' dungeon xp`);
						await this.resetXp({ offsetToReset: offset, typesToReset: DUNGEON_TYPES_AND_CLASSES });
					}
				}
			}

			// no dungeons data found logging
			if (!Reflect.has(playerData.dungeons?.dungeon_types?.catacombs ?? {}, 'experience') && !(new Date().getHours() % 6) && new Date().getMinutes() < this.client.config.get('DATABASE_UPDATE_INTERVAL')) {
				logger.warn(`[UPDATE XP]: ${this.logInfo}: no dungeons data found`);
			}

			/**
			 * collections
			 */
			if (!Reflect.has(playerData, 'collection') && !(new Date().getHours() % 6) && new Date().getMinutes() < this.client.config.get('DATABASE_UPDATE_INTERVAL')) {
				logger.warn(`[UPDATE XP]: ${this.logInfo}: collections API disabled`);
			}

			await this.save();
		} catch (error) {
			if (typeof error === 'string') return logger.error(`[UPDATE XP]: ${this.logInfo}: ${error}`);
			if ((error instanceof Error && error.name.startsWith('Sequelize')) || error instanceof TypeError || error instanceof RangeError) {
				return logger.error(`[UPDATE XP]: ${this.logInfo}`, error);
			}

			logger.error(`[UPDATE XP]: ${this.logInfo}`, error);
			if (!(error instanceof RateLimitError)) this.client.config.set('HYPIXEL_SKYBLOCK_API_ERROR', true);
			if (rejectOnAPIError) throw error;
		}
	}

	/**
	 * updates discord roles and nickname
	 * @param options
	 * @param options.reason role update reason for discord's audit logs
	 * @param options.shouldSendDm wether to dm the user that they should include their ign somewhere in their nickname
	 */
	async updateDiscordMember({ reason: reasonInput = 'synced with in game stats', shouldSendDm = false } = {}) {
		if (this.discordMemberUpdatesDisabled) return;
		if (this.guildId === GUILD_ID_BRIDGER) return;

		let reason = reasonInput;

		const member = await this.discordMember ?? (reason = 'found linked discord tag', await this.linkUsingCache());

		if (this.guildId === GUILD_ID_ERROR) return this.removeFromGuild(); // player left the guild but discord member couldn't be updated for some reason

		if (!member) return; // no linked available discord member to update
		if (!member.roles.cache.has(this.client.config.get('VERIFIED_ROLE_ID'))) {
			return logger.warn(`[UPDATE DISCORD MEMBER]: ${this.logInfo} | ${member.user.tag} | ${member.displayName}: missing verified role`);
		}

		await this.updateRoles(reason);
		await this.syncIgnWithDisplayName(shouldSendDm);
	}

	/**
	 * updates the skyblock related discord roles using the db data
	 * @param reasonInput reason for discord's audit logs
	 */
	async updateRoles(reasonInput?: string) {
		const member = await this.discordMember;

		if (!member) return;

		const { config } = this.client;
		const rolesToAdd: Snowflake[] = [];
		const rolesToRemove: Snowflake[] = [];

		let inGuild = false;
		let reason = reasonInput;

		// individual hypixel guild roles
		for (const [ guildId, { roleId }] of this.client.hypixelGuilds.cache) {
			if (!roleId) continue;

			// player is in the guild
			if (guildId === this.guildId) {
				if (!member.roles.cache.has(roleId)) rolesToAdd.push(roleId);
				inGuild = true;

			// player is not in the guild
			} else if (member.roles.cache.has(roleId)) {
				rolesToRemove.push(roleId);
			}
		}

		// player is not in a guild from <LunarClient>.hypixelGuilds
		if (!inGuild) {
			if (member.roles.cache.has(config.get('GUILD_ROLE_ID'))) rolesToRemove.push(config.get('GUILD_ROLE_ID'));
			return this.makeRoleAPICall({ rolesToAdd, rolesToRemove, reason });
		}

		// combined guild roles
		if (!member.roles.cache.has(config.get('GUILD_ROLE_ID'))) rolesToAdd.push(config.get('GUILD_ROLE_ID'));
		if (member.roles.cache.has(config.get('EX_GUILD_ROLE_ID'))) rolesToRemove.push(config.get('EX_GUILD_ROLE_ID'));

		// guild delimiter role (only if it doesn't overwrite current colour role, delimiters have invis colour)
		if ((member.roles.color?.comparePositionTo(config.get('GUILD_DELIMITER_ROLE_ID') ?? member.guild.roles.highest) ?? -1) > 1) {
			if (!member.roles.cache.has(config.get('GUILD_DELIMITER_ROLE_ID'))) rolesToAdd.push(config.get('GUILD_DELIMITER_ROLE_ID'));
		} else if (member.roles.cache.has(config.get('GUILD_DELIMITER_ROLE_ID'))) {
			rolesToRemove.push(config.get('GUILD_DELIMITER_ROLE_ID'));
		}

		// other delimiter roles
		for (let i = 1; i < DELIMITER_ROLES.length; ++i) {
			if (!member.roles.cache.has(config.get(`${DELIMITER_ROLES[i]}_DELIMITER_ROLE_ID`))) rolesToAdd.push(config.get(`${DELIMITER_ROLES[i]}_DELIMITER_ROLE_ID`));
		}

		// hypixel guild ranks
		const { guildRank } = this;

		if (guildRank) {
			if (guildRank.roleId && !member.roles.cache.has(guildRank.roleId)) {
				reason = 'synced with in game rank';
				rolesToAdd.push(guildRank.roleId);
			}

			if (!this.isStaff) { // non staff rank -> remove other ranks
				const { hypixelGuild } = this;

				if (hypixelGuild) {
					for (const { roleId, priority } of hypixelGuild.ranks) {
						if (!roleId || priority !== this.guildRankPriority) continue;
						if (member.roles.cache.has(roleId)) rolesToRemove.push(roleId);
					}
				}
			}
		}

		// skills
		const skillAverage = SKILLS
			.map((skill) => { // individual skill lvl 45+ / 50+ / 55+ / 60
				const { progressLevel } = this.getSkillLevel(skill);
				const CURRENT_LEVEL_MILESTONE = Math.floor(progressLevel / 5) * 5; // round down to nearest divisible by 5

				// individual skills
				for (const level of SKILL_ROLES) {
					if (level === CURRENT_LEVEL_MILESTONE) {
						if (!member.roles.cache.has(config.get(`${skill}_${level}_ROLE_ID`))) rolesToAdd.push(config.get(`${skill}_${level}_ROLE_ID`));
					} else if (member.roles.cache.has(config.get(`${skill}_${level}_ROLE_ID`))) {
						rolesToRemove.push(config.get(`${skill}_${level}_ROLE_ID`));
					}
				}

				return progressLevel;
			})
			.reduce((acc, level) => acc + level, 0) / SKILLS.length;

		// average skill
		let currentLvlMilestone = Math.floor(skillAverage / 5) * 5; // round down to nearest divisible by 5

		for (const level of SKILL_AVERAGE_ROLES) {
			if (level === currentLvlMilestone) {
				if (!member.roles.cache.has(config.get(`AVERAGE_LVL_${level}_ROLE_ID`))) rolesToAdd.push(config.get(`AVERAGE_LVL_${level}_ROLE_ID`));
			} else if (member.roles.cache.has(config.get(`AVERAGE_LVL_${level}_ROLE_ID`))) {
				rolesToRemove.push(config.get(`AVERAGE_LVL_${level}_ROLE_ID`));
			}
		}

		// slayers
		const LOWEST_SLAYER_LVL = Math.min(...SLAYERS.map((slayer) => {
			const SLAYER_LVL = this.getSlayerLevel(slayer);

			// individual slayer
			for (const level of SLAYER_ROLES) {
				if (level === SLAYER_LVL) {
					if (!member.roles.cache.has(config.get(`${slayer}_${level}_ROLE_ID`))) rolesToAdd.push(config.get(`${slayer}_${level}_ROLE_ID`));
				} else if (member.roles.cache.has(config.get(`${slayer}_${level}_ROLE_ID`))) {
					rolesToRemove.push(config.get(`${slayer}_${level}_ROLE_ID`));
				}
			}

			return SLAYER_LVL;
		}));

		// total slayer
		for (const level of SLAYER_TOTAL_ROLES) {
			if (level === LOWEST_SLAYER_LVL) {
				if (!member.roles.cache.has(config.get(`SLAYER_ALL_${level}_ROLE_ID`))) rolesToAdd.push(config.get(`SLAYER_ALL_${level}_ROLE_ID`));
			} else if (member.roles.cache.has(config.get(`SLAYER_ALL_${level}_ROLE_ID`))) {
				rolesToRemove.push(config.get(`SLAYER_ALL_${level}_ROLE_ID`));
			}
		}

		// dungeons
		currentLvlMilestone = Math.floor(this.getSkillLevel('catacombs').trueLevel / 5) * 5; // round down to nearest divisible by 5

		for (const level of CATACOMBS_ROLES) {
			if (level === currentLvlMilestone) {
				if (!member.roles.cache.has(config.get(`CATACOMBS_${level}_ROLE_ID`))) rolesToAdd.push(config.get(`CATACOMBS_${level}_ROLE_ID`));
			} else if (member.roles.cache.has(config.get(`CATACOMBS_${level}_ROLE_ID`))) {
				rolesToRemove.push(config.get(`CATACOMBS_${level}_ROLE_ID`));
			}
		}

		// weight
		if (this.getSenitherWeight().totalWeight >= config.get('WHALECUM_PASS_WEIGHT')) {
			if (!member.roles.cache.has(config.get('WHALECUM_PASS_ROLE_ID'))) rolesToAdd.push(config.get('WHALECUM_PASS_ROLE_ID'));
		} else if (member.roles.cache.has(config.get('WHALECUM_PASS_ROLE_ID'))) {
			rolesToRemove.push(config.get('WHALECUM_PASS_ROLE_ID'));
		}

		// api call
		return this.makeRoleAPICall({ rolesToAdd, rolesToRemove, reason });
	}

	/**
	 * tries to link unlinked players via discord.js-cache (without any discord API calls)
	 */
	async linkUsingCache() {
		const { lgGuild } = this.client;

		if (!lgGuild) return null;

		let member;

		if (this.discordId) { // tag or ID known
			member = /\D/.test(this.discordId)
				? lgGuild.members.cache.find(({ user: { tag } }) => tag === this.discordId) // tag known
				: lgGuild.members.cache.get(this.discordId); // id known

			if (!member) {
				const DISCORD_TAG = await this.fetchDiscordTag();

				if (!DISCORD_TAG) return null;

				member = lgGuild.members.cache.find(({ user: { tag } }) => tag === DISCORD_TAG);
			}
		} else { // unknown tag
			const DISCORD_TAG = await this.fetchDiscordTag();

			if (!DISCORD_TAG) return null;

			member = lgGuild.members.cache.find(({ user: { tag } }) => tag === DISCORD_TAG);
		}

		if (!member) return null;

		logger.info(`[UPDATE ROLES]: ${this.logInfo}: discord data found: ${member.user.tag}`);

		await this.link(member);

		return member;
	}

	/**
	 * validates the discordId and only updates it if the validation passes
	 * @param value
	 */
	async setValidDiscordId(value: string | null) {
		const OLD_DISCORD_ID = this.discordId;

		try {
			await this.update({ discordId: value });
		} catch (error) {
			this.discordId = OLD_DISCORD_ID;
			throw error;
		}
	}

	/**
	 * links a player to the provided discord guild member, updating roles and nickname
	 * @param idOrDiscordMember the member to link the player to
	 * @param reason reason for discord's audit logs
	 */
	async link(idOrDiscordMember: GuildMember | Snowflake, reason?: string) {
		if (idOrDiscordMember instanceof GuildMember) {
			await this.setValidDiscordId(idOrDiscordMember.id);
			this.inDiscord = true;
			this.discordMember = idOrDiscordMember;

			logger.info(`[LINK]: ${this.logInfo}: linked to '${idOrDiscordMember.user.tag}'`);

			if (reason) await this.updateData({ reason });
		} else if (typeof idOrDiscordMember === 'string' && validateNumber(idOrDiscordMember)) {
			await this.setValidDiscordId(idOrDiscordMember);
			this.inDiscord = false;
		} else {
			throw new Error('[LINK]: input must be either a discord GuildMember or a discord ID');
		}

		return this.save();
	}

	/**
	 * unlinks a player from a discord member, purging roles and nickname
	 * @param reason reason for discord's audit logs
	 */
	async unlink(reason?: string) {
		const currentlyLinkedMember = await this.discordMember;

		let wasSuccessful = true;

		if (currentlyLinkedMember) {
			// remove roles that the bot manages
			const rolesToRemove = GuildMemberUtil.getRolesToPurge(currentlyLinkedMember);

			if (rolesToRemove.length) wasSuccessful = await this.makeRoleAPICall({ rolesToRemove, reason });

			// reset nickname if it is set to the player's ign
			if (currentlyLinkedMember.nickname === this.ign) {
				// needs to be changed temporarily so that client.on('guildMemberUpdate', ...) doesn't change the nickname back to the ign
				const { guildId } = this; // 1/3
				this.guildId = GUILD_ID_ERROR; // 2/3

				wasSuccessful = (await this.makeNickAPICall({ reason })) && wasSuccessful;

				if (this.guildId === GUILD_ID_ERROR) this.guildId = guildId; // 3/3
			}
		}

		this.discordId = null;

		await this.save();

		if (!this.guildId) this.uncache(); // uncache if player left the guild and is not a bridger

		return wasSuccessful;
	}

	/**
	 * adds and/or removes the provided roles and logs it via the log handler, returns true or false depending on the success
	 * @param rolesToAdd roles to add to the member
	 * @param rolesToRemove roles to remove from the member
	 * @param reason reason for discord's audit logs
	 */
	async makeRoleAPICall({ rolesToAdd = [], rolesToRemove = [], reason }: { rolesToAdd?: RoleResolvables; rolesToRemove?: RoleResolvables; reason?: string; }) {
		const member = await this.discordMember;
		if (!member) return false;

		// check if IDs are proper roles and managable by the bot
		const _rolesToAdd = GuildUtil.resolveRoles(member.guild, rolesToAdd);
		const _rolesToRemove = GuildUtil.resolveRoles(member.guild, rolesToRemove);

		if (!_rolesToAdd.length && !_rolesToRemove.length) return true;

		// permission check
		if (!member.guild.me!.permissions.has(Permissions.FLAGS.MANAGE_ROLES)) return (logger.warn(`[ROLE API CALL]: missing 'MANAGE_ROLES' in '${member.guild.name}'`), false);

		const { config } = this.client;
		const loggingEmbed = new MessageEmbed()
			.setAuthor(member.user.tag, member.displayAvatarURL({ dynamic: true }), this.url)
			.setThumbnail((await this.imageURL)!)
			.setDescription(stripIndents`
				${Formatters.bold('Role Update')} for ${member}
				${this.info}
			`)
			.setTimestamp();
		const NAMES_TO_ADD = _rolesToAdd.length
			? Formatters.codeBlock(_rolesToAdd.map(({ name }) => name).join('\n'))
			: null;
		const NAMES_TO_REMOVE = _rolesToRemove.length
			? Formatters.codeBlock(_rolesToRemove.map(({ name }) => name).join('\n'))
			: null;
		const IS_ADDING_GUILD_ROLE = _rolesToAdd.some(({ id }) => id === config.get('GUILD_ROLE_ID'));

		for (const role of member.roles.cache.values()) {
			if (_rolesToRemove.some(({ id }) => role.id === id)) continue;
			_rolesToAdd.push(role);
		}

		try {
			// api call
			this.discordMember = await member.roles.set(
				_rolesToAdd,
				reason,
			);

			if (NAMES_TO_ADD) loggingEmbed.addFields({
				name: 'Added',
				value: NAMES_TO_ADD,
				inline: true,
			});

			if (NAMES_TO_REMOVE) loggingEmbed.addFields({
				name: 'Removed',
				value: NAMES_TO_REMOVE,
				inline: true,
			});

			// was successful
			loggingEmbed.setColor(IS_ADDING_GUILD_ROLE ? config.get('EMBED_GREEN') : config.get('EMBED_BLUE'));

			return true;
		} catch (error) { // was not successful
			this.discordMember = null;

			logger.error('[ROLE API CALL]', error);

			loggingEmbed
				.setColor(config.get('EMBED_RED'))
				.addFields(error instanceof Error
					? {
						name: error.name,
						value: error.message,
					} : {
						name: 'Error',
						value: `${error}`,
					},
				);

			if (NAMES_TO_ADD) loggingEmbed.addFields({
				name: 'Failed to add',
				value: NAMES_TO_ADD,
				inline: true,
			});

			if (NAMES_TO_REMOVE) loggingEmbed.addFields({
				name: 'Failed to remove',
				value: NAMES_TO_REMOVE,
				inline: true,
			});

			return false;
		} finally {
			// logging
			this.client.log(MessageEmbedUtil.padFields(loggingEmbed, 2));
		}
	}

	/**
	 * removes the discord server in game guild role & all roles handled automatically by the bot
	 */
	async removeFromGuild() {
		const member = await this.discordMember;

		let isBridger = false;

		if (member) {
			const { config } = this.client;
			const rolesToAdd = (Date.now() - this.createdAt.getTime() >= 7 * 24 * 60 * 60_000) && !member.roles.cache.has(config.get('EX_GUILD_ROLE_ID'))
				? [ config.get('EX_GUILD_ROLE_ID') ] // add ex guild role if player stayed for more than 1 week
				: [];
			const rolesToRemove = GuildMemberUtil.getRolesToPurge(member);

			if (!await this.makeRoleAPICall({ rolesToAdd, rolesToRemove, reason: `left ${this.guildName}` })) {
				// error updating roles
				logger.warn(`[REMOVE FROM GUILD]: ${this.logInfo}: unable to update roles`);
				this.guildId = GUILD_ID_ERROR;
				this.save();
				return false;
			}

			isBridger = member.roles.cache.has(config.get('BRIDGER_ROLE_ID'));
		} else {
			logger.info(`[REMOVE FROM GUILD]: ${this.logInfo}: left without being in the discord`);
		}

		if (isBridger) {
			this.client.hypixelGuilds.sweepPlayerCache(this.guildId); // sweep hypixel guild player cache (uncache light)
			this.guildId = GUILD_ID_ERROR;
		} else {
			this.uncache(); // uncache everything
			this.guildId = null;
		}

		this.guildRankPriority = 0;
		this.save();

		return true;
	}

	/**
	 * check if the discord member's display name includes the player ign and is unique. Tries to change it if it doesn't / isn't
	 * @param shouldSendDm wether to dm the user that they should include their ign somewhere in their nickname
	 */
	async syncIgnWithDisplayName(shouldSendDm = false) {
		if (!this.inGuild()) return;

		const member = await this.discordMember;
		if (!member) return;

		let reason;

		// nickname doesn't include ign
		if (!member.displayName.toLowerCase().includes(this.ign.toLowerCase())) reason = NickChangeReason.NO_IGN;

		// two guild members share the same display name
		if (GuildMemberUtil.getPlayer(member.guild.members.cache.find(({ displayName, id }) => displayName.toLowerCase() === member.displayName.toLowerCase() && id !== member.id))) {
			reason = NickChangeReason.NOT_UNIQUE;
		}

		if (!reason) return;
		if (this.ign === UNKNOWN_IGN) return; // mojang api error

		// check if member already has a nick which is not just the current ign (case insensitive)
		let newNick = member.nickname && member.nickname.toLowerCase() !== this.ign.toLowerCase()
			? `${trim(member.nickname, NICKNAME_MAX_CHARS - this.ign.length - ' ()'.length).replace(/ +(?:\([^ )]*?)?\.{3}$/, '')} (${this.ign})`
			: this.ign;

		// 'nick (ign)' already exists
		if (GuildMemberUtil.getPlayer(member.guild.members.cache.find(({ displayName, id }) => displayName.toLowerCase() === newNick.toLowerCase() && id !== member.id))) {
			newNick = this.ign;
		}

		return this.makeNickAPICall({ newNick, shouldSendDm, reason });
	}

	/**
	 * sets a nickname for the player's discord member
	 * @param newNick new nickname, null to remove the current nickname
	 * @param shouldSendDm wether to dm the user that they should include their ign somewhere in their nickname
	 * @param reason reason for discord's audit logs and the DM
	 */
	async makeNickAPICall({ newNick = null, shouldSendDm = false, reason }: { newNick?: string | null, shouldSendDm?: boolean, reason?: string | NickChangeReason } = {}) {
		const member = await this.discordMember;
		if (!member) return false;

		// permission checks
		const { me } = member.guild;
		if (me!.roles.highest.comparePositionTo(member.roles.highest) < 1) return false; // member's highest role is above bot's highest role
		if (member.guild.ownerId === member.id) return false; // can't change nick of owner
		if (!me!.permissions.has(Permissions.FLAGS.MANAGE_NICKNAMES)) return (logger.warn(`[SYNC IGN DISPLAYNAME]: ${this.logInfo}: missing 'MANAGE_NICKNAMES' in ${member.guild.name}`), false);

		const { displayName: PREV_NAME } = member;

		try {
			let auditLogReason;

			switch (reason) {
				case NickChangeReason.NO_IGN:
					auditLogReason = 'name didn\'t contain ign';
					break;

				case NickChangeReason.NOT_UNIQUE:
					auditLogReason = 'name already taken';
					break;

				default:
					auditLogReason = reason;
			}

			this.discordMember = await member.setNickname(newNick, auditLogReason);

			await this.client.log(
				this.client.defaultEmbed
					.setAuthor(member.user.tag, member.displayAvatarURL({ dynamic: true }), this.url)
					.setThumbnail((await this.imageURL)!)
					.setDescription(stripIndents`
						${Formatters.bold('Nickname Update')} for ${member}
						${this.info}
					`)
					.addFields({
						name: 'Old nickname',
						value: Formatters.codeBlock(PREV_NAME),
						inline: true,
					}, {
						name: 'New nickname',
						value: Formatters.codeBlock(newNick ?? member.user.username),
						inline: true,
					}),
			);

			if (shouldSendDm) {
				switch (reason) {
					case NickChangeReason.NO_IGN:
						GuildMemberUtil.sendDM(member, stripIndents`
							include your ign \`${this.ign}\` somewhere in your nickname.
							If you just changed your ign, wait up to ${this.client.config.get('DATABASE_UPDATE_INTERVAL')} minutes and ${this.client.user} will automatically change your discord nickname
						`);
						break;

					case NickChangeReason.NOT_UNIQUE:
						GuildMemberUtil.sendDM(member, stripIndents`
							the name \`${PREV_NAME}\` is already taken by another guild member.
							Your name should be unique to allow staff members to easily identify you
						`);
						break;

					default:
						logger.error(`[SYNC IGN DISPLAYNAME]: unknown reason: ${reason}`);
				}

				logger.info(`[SYNC IGN DISPLAYNAME]: ${this.logInfo}: sent nickname info DM`);
			}

			return true;
		} catch (error) {
			logger.error(`[SYNC IGN DISPLAYNAME]: ${this.logInfo}`, error);
			this.discordMember = null;
			return false;
		}
	}

	/**
	 * fetches the discord tag from hypixel
	 */
	async fetchDiscordTag() {
		try {
			return (await hypixel.player.uuid(this.minecraftUuid)).socialMedia?.links?.DISCORD ?? null;
		} catch (error) {
			return logger.error(`[FETCH DISCORD TAG]: ${this.logInfo}`, error);
		}
	}

	/**
	 * determines the player's main profile (profile with the most weight)
	 */
	async fetchMainProfile() {
		let profiles = null;

		try {
			profiles = await hypixel.skyblock.profiles.uuid(this.minecraftUuid) as SkyBlockProfile[];
		} catch (error) {
			this.update({ xpUpdatesDisabled: true }).catch(logger.error);
			logger.error('[MAIN PROFILE]', error);
		}

		if (!profiles?.length) {
			this.mainProfileId = null;
			await this.resetXp({ offsetToReset: OFFSET_FLAGS.CURRENT });

			throw `${this.logInfo}: no SkyBlock profiles`;
		}

		let mainProfile;
		let maxWeight = -1;

		for (const profile of profiles) {
			const { totalWeight } = getSenitherWeight(profile.members[this.minecraftUuid]);

			if (maxWeight > totalWeight) continue;

			mainProfile = profile;
			maxWeight = totalWeight;
		}

		if (!mainProfile) {
			this.mainProfileId = null;
			await this.resetXp({ offsetToReset: OFFSET_FLAGS.CURRENT });

			throw `${this.logInfo}: no SkyBlock profiles`;
		}

		const { profile_id: PROFILE_ID, cute_name: PROFILE_NAME } = mainProfile;

		if (PROFILE_ID === this.mainProfileId) return null;

		const { mainProfileName } = this;

		this.mainProfileId = PROFILE_ID;
		this.mainProfileName = PROFILE_NAME ?? 'unknown profile name';
		this.xpUpdatesDisabled = false;
		await this.save();

		logger.info(`[MAIN PROFILE]: ${this.logInfo} -> ${PROFILE_NAME}`);

		return {
			oldProfileName: mainProfileName,
			newProfileName: PROFILE_NAME,
		};
	}

	/**
	 * updates the player's IGN via the mojang API
	 */
	async updateIgn() {
		try {
			const { ign: CURRENT_IGN } = await mojang.uuid(this.minecraftUuid, { force: true });

			if (CURRENT_IGN === this.ign) return null;

			const { ign: OLD_IGN } = this;

			try {
				this.ign = CURRENT_IGN;
				await this.save();
			} catch (error) {
				this.ign = OLD_IGN;
				return logger.error(`[UPDATE IGN]: ${this.logInfo}`, error);
			}

			this.syncIgnWithDisplayName(false);

			return {
				oldIgn: OLD_IGN,
				newIgn: CURRENT_IGN,
			};
		} catch (error) {
			if ((error instanceof Error && error.name.startsWith('Sequelize')) || error instanceof TypeError || error instanceof RangeError) {
				return logger.error(`[UPDATE IGN]: ${this.logInfo}`, error);
			}

			// prevent further auto updates
			this.client.config.set('MOJANG_API_ERROR', true);

			if (error instanceof Error && error.name === 'AbortError') {
				return logger.error(`[UPDATE IGN]: ${this.logInfo}: request timeout`);
			}

			return logger.error(`[UPDATE IGN]: ${this.logInfo}`, error);
		}
	}

	/**
	 * transfers xp offsets
	 * @param options
	 * @param options.from
	 * @param options.to
	 * @param options.types
	 */
	transferXp({ from = '', to = '', types = XP_TYPES }: TransferXpOptions) {
		for (const type of types) {
			this[`${type}Xp${to}`] = this[`${type}Xp${from}`];
		}

		return this.save();
	}

	/**
	 * resets the xp gained to 0
	 * @param options
	 * @param options.offsetToReset
	 * @param options.typesToReset
	 */
	async resetXp({ offsetToReset = null, typesToReset = XP_TYPES }: ResetXpOptions = {}): Promise<this> {
		switch (offsetToReset) {
			case null:
				// no offset type specifies -> resetting everything
				await Promise.all(XP_OFFSETS.map(offset => this.resetXp({ offsetToReset: offset, typesToReset })));
				return this.resetXp({ offsetToReset: OFFSET_FLAGS.DAY, typesToReset });

			case OFFSET_FLAGS.DAY:
				// append current xp to the beginning of the xpHistory-Array and pop of the last value
				for (const type of typesToReset) {
					const xpHistory = this[`${type}XpHistory`];
					xpHistory.shift();
					xpHistory.push(this[`${type}Xp`]);
					this.changed(`${type}XpHistory`, true); // neccessary so that sequelize knows an array has changed and the db needs to be updated
				}
				break;

			case OFFSET_FLAGS.CURRENT:
				for (const type of typesToReset) this[`${type}Xp`] = 0;
				break;

			default:
				for (const type of typesToReset) this[`${type}Xp${offsetToReset}`] = this[`${type}Xp`];
				break;
		}

		return this.save();
	}

	/**
	 * resets the guild tax paid
	 */
	async resetTax() {
		if (!this.paid) return this;

		const result = await this.client.db.models.Transaction.findAll({
			limit: 1,
			where: {
				from: this.minecraftUuid,
				type: 'tax',
			},
			order: [ [ 'createdAt', 'DESC' ] ],
			attributes: [ 'to', 'amount' ],
			raw: true,
		});
		if (result.length) this.client.taxCollectors.cache.get(result[0].to)?.addAmount(-result[0].amount, 'tax');

		this.paid = false;
		return this.save();
	}

	/**
	 * set the player to paid
	 * @param options
	 */
	async setToPaid({ amount = this.client.config.get('TAX_AMOUNT'), collectedBy = this.minecraftUuid, auctionId = null }: SetToPaidOptions = {}) {
		if (this.paid) {
			await Promise.all(this.addTransfer({ amount, collectedBy, auctionId, type: 'donation' }));
		} else {
			const overflow = Math.max(amount - this.client.config.get('TAX_AMOUNT'), 0); // >=
			const taxAmount = amount - overflow;
			const promises = this.addTransfer({ amount: taxAmount, collectedBy, auctionId, type: 'tax' });

			if (overflow) promises.push(...this.addTransfer({ amount: overflow, collectedBy, auctionId, type: 'donation' }));

			await Promise.all(promises);

			this.paid = true;
		}

		return this.save();
	}

	/**
	 * set the player to paid
	 * @param options
	 * @param options.type
	 * @param options.notes
	 */
	addTransfer({ amount, collectedBy, auctionId = null, notes = null, type = 'tax' }: AddTransferOptions): [ Promise<TaxCollector>, Promise<Transaction> ] {
		const taxCollector = this.client.taxCollectors.resolve(collectedBy);
		if (!taxCollector) throw new Error(`unknown tax collector resolvable ${collectedBy}`);

		return [
			taxCollector.addAmount(amount, type), // update taxCollector
			this.client.db.models.Transaction.create({
				from: this.minecraftUuid,
				to: taxCollector.minecraftUuid,
				amount,
				auctionId,
				notes,
				type,
			}),
		];
	}

	/**
	 * removes the dual link between a discord member / user and the player
	 */
	async uncacheMember() {
		if (!this.discordId) return;

		// remove from member player cache
		const member = await this.discordMember;
		if (member) GuildMemberUtil.setPlayer(member, null);

		// remove from user player cache
		const user = this.client.users.cache.get(this.discordId);
		if (user) UserUtil.setPlayer(user, null);

		// remove cached member
		this.#discordMember = null;
	}

	/**
	 * removes the element from member, user, guild, client cache
	 */
	async uncache() {
		await this.uncacheMember();

		// remove from guild / client player cache
		this.client.hypixelGuilds.sweepPlayerCache(this.guildId); // sweep hypixel guild player cache
		this.client.players.cache.delete(this.minecraftUuid);

		return this;
	}

	/**
	 * destroys the db entry and removes it from cache
	 */
	override async destroy() {
		await this.uncache();
		return super.destroy();
	}

	/**
	 * updates the guild xp and syncs guild mutes
	 * @param data from the hypixel guild API
	 * @param hypixelGuild
	 */
	syncWithGuildData({ expHistory = {}, mutedTill, rank }: Components.Schemas.GuildMember, hypixelGuild = this.hypixelGuild!) {
		// update guild xp
		const [ currentDay ] = Object.keys(expHistory);

		if (currentDay) {
			const xp = expHistory[currentDay];

			if (this.guildXpDay === currentDay) { // xp gained on the same day
				if (xp > this.guildXpDaily) { // player gained gxp since last update
					this.guildXp += xp - this.guildXpDaily; // add delta
					this.guildXpDaily = xp;
				}
			} else { // new day
				this.guildXpDay = currentDay;
				this.guildXpDaily = xp;
				this.guildXp += xp;
			}
		}

		// sync guild mutes
		this.mutedTill = mutedTill!;

		// update guild rank
		this.guildRankPriority = hypixelGuild.ranks.find(({ name }) => name === rank)?.priority ?? (/^guild ?master$/i.test(rank) ? hypixelGuild.ranks.length + 1 : 1);

		return this.save();
	}

	/**
	 * returns the true and progression level for the provided skill type
	 * @param type the skill or dungeon type
	 * @param offset optional offset value to use instead of the current xp value
	 * @param useIndividualCap wether to use the individual max level cap if existing
	 */
	getSkillLevel(type: SkillTypes | DungeonTypes, offset: XPOffsets = '', useIndividualCap = true) {
		return getSkillLevel(type, this[`${type}Xp${offset}`], type === 'farming' && useIndividualCap ? this.farmingLvlCap : null);
	}

	/**
	 * returns the true and progression skill average
	 * @param offset optional offset value to use instead of the current xp value
	 */
	getSkillAverage(offset: XPOffsets = '') {
		let skillAverage = 0;
		let trueAverage = 0;

		for (const skill of SKILLS) {
			const { trueLevel, nonFlooredLevel } = this.getSkillLevel(skill, offset);

			skillAverage += nonFlooredLevel;
			trueAverage += trueLevel;
		}

		const SKILL_COUNT = SKILLS.length;

		return {
			skillAverage: Number((skillAverage / SKILL_COUNT).toFixed(2)),
			trueAverage: Number((trueAverage / SKILL_COUNT).toFixed(2)),
		};
	}

	/**
	 * returns the slayer level for the provided slayer type
	 * @param type the slayer type
	 */
	getSlayerLevel(type: SlayerTypes) {
		const XP = this[`${type}Xp`];
		const MAX_LEVEL = Math.max(...Object.keys(SLAYER_XP) as unknown as number[]);

		let level = 0;

		for (let x = 1; x <= MAX_LEVEL && SLAYER_XP[x as keyof typeof SLAYER_XP] <= XP; ++x) {
			level = x;
		}

		return level;
	}

	/**
	 * returns the total slayer xp
	 * @param offset optional offset value to use instead of the current xp value
	 */
	getSlayerTotal(offset: XPOffsets = '') {
		return SLAYERS.reduce((acc, slayer) => acc + this[`${slayer}Xp${offset}`], 0);
	}

	/**
	 * calculates the player's weight using Senither's formula
	 * @param offset optional offset value to use instead of the current xp value
	 */
	getSenitherWeight(offset: XPOffsets = '') {
		let weight = 0;
		let overflow = 0;

		for (const skill of SKILLS) {
			const { skillWeight, skillOverflow } = getSenitherSkillWeight(skill, this[`${skill}Xp${offset}`]);

			weight += skillWeight;
			overflow += skillOverflow;
		}

		for (const slayer of SLAYERS) {
			const { slayerWeight, slayerOverflow } = getSenitherSlayerWeight(slayer, this[`${slayer}Xp${offset}`]);

			weight += slayerWeight;
			overflow += slayerOverflow;
		}

		for (const type of DUNGEON_TYPES_AND_CLASSES) {
			const { dungeonWeight, dungeonOverflow } = getSenitherDungeonWeight(type, this[`${type}Xp${offset}`]);

			weight += dungeonWeight;
			overflow += dungeonOverflow;
		}

		return {
			weight,
			overflow,
			totalWeight: weight + overflow,
		};
	}

	/**
	 * returns the true and progression level for the provided skill type
	 * @param type the skill or dungeon type
	 * @param index xpHistory array index
	 */
	getSkillLevelHistory(type: SkillTypes | DungeonTypes, index: number) {
		return getSkillLevel(type, this[`${type}XpHistory`][index], type === 'farming' ? this.farmingLvlCap : null);
	}

	/**
	 * returns the true and progression skill average
	 * @param index xpHistory array index
	 */
	getSkillAverageHistory(index: number) {
		let skillAverage = 0;
		let trueAverage = 0;

		for (const skill of SKILLS) {
			const { trueLevel, nonFlooredLevel } = this.getSkillLevelHistory(skill, index);

			skillAverage += nonFlooredLevel;
			trueAverage += trueLevel;
		}

		const SKILL_COUNT = SKILLS.length;

		return {
			skillAverage: Number((skillAverage / SKILL_COUNT).toFixed(2)),
			trueAverage: Number((trueAverage / SKILL_COUNT).toFixed(2)),
		};
	}

	/**
	 * returns the total slayer xp
	 * @param index xpHistory array index
	 */
	getSlayerTotalHistory(index: number) {
		return SLAYERS.reduce((acc, slayer) => acc + this[`${slayer}XpHistory`][index], 0);
	}

	/**
	 * calculates the player's weight using Senither's formula
	 * @param index xpHistory array index
	 */
	getSenitherWeightHistory(index: number) {
		let weight = 0;
		let overflow = 0;

		for (const skill of SKILLS) {
			const { skillWeight, skillOverflow } = getSenitherSkillWeight(skill, this[`${skill}XpHistory`][index]);

			weight += skillWeight;
			overflow += skillOverflow;
		}

		for (const slayer of SLAYERS) {
			const { slayerWeight, slayerOverflow } = getSenitherSlayerWeight(slayer, this[`${slayer}XpHistory`][index]);

			weight += slayerWeight;
			overflow += slayerOverflow;
		}

		for (const type of DUNGEON_TYPES_AND_CLASSES) {
			const { dungeonWeight, dungeonOverflow } = getSenitherDungeonWeight(type, this[`${type}XpHistory`][index]);

			weight += dungeonWeight;
			overflow += dungeonOverflow;
		}

		return {
			weight,
			overflow,
			totalWeight: weight + overflow,
		};
	}

	/**
	 * adds the current timestamp to infractions
	 */
	addInfraction() {
		this._infractions ??= []; // create infractions array if non-existent
		this._infractions.push(Date.now()); // add current time
		this.changed('_infractions', true); // neccessary so that sequelize knows an array has changed and the db needs to be updated
		return this.save();
	}

	/**
	 * player IGN
	 */
	override toString() {
		return this.ign;
	}
}

export default Player;
