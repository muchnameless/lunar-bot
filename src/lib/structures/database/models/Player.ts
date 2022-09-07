import { GuildMemberLimits } from '@sapphire/discord-utilities';
import { type ArrayElementType } from '@sapphire/utilities';
import { RateLimitError, type Components } from '@zikeji/hypixel';
import { stripIndents } from 'common-tags';
import {
	bold,
	codeBlock,
	DiscordAPIError,
	EmbedBuilder,
	GuildMember,
	hyperlink,
	PermissionFlagsBits,
	type Snowflake,
	type GuildResolvable,
	type Guild,
} from 'discord.js';
import type LilyWeight from 'lilyweight';
import {
	DataTypes,
	fn,
	Model,
	UniqueConstraintError,
	type Attributes,
	type CreationOptional,
	type FindOptions,
	type InferAttributes,
	type InferCreationAttributes,
	type InstanceDestroyOptions,
	type ModelAttributeColumnOptions,
	type ModelStatic,
	type NonAttribute,
	type Sequelize,
} from 'sequelize';
import { type ModelResovable } from '../managers/ModelManager.js';
import { type GuildRank, type HypixelGuild } from './HypixelGuild.js';
import { type TaxCollector } from './TaxCollector.js';
import { TransactionType, type Transaction } from './Transaction.js';
import { getSkyBlockProfiles, hypixel, mojang } from '#api';
import {
	CATACOMBS_ROLES,
	COSMETIC_SKILLS,
	DELIMITER_ROLES,
	DUNGEON_CLASSES,
	DUNGEON_TYPES,
	DUNGEON_TYPES_AND_CLASSES,
	FindProfileStrategy,
	GUILD_ID_ERROR,
	isXPType,
	LILY_SKILL_NAMES,
	Offset,
	SKILL_ACHIEVEMENTS,
	SKILL_AVERAGE_ROLES,
	SKILL_ROLES,
	SKILL_XP_TOTAL,
	SKILLS,
	SLAYER_ROLES,
	SLAYER_TOTAL_ROLES,
	SLAYERS,
	UNKNOWN_IGN,
	XP_AND_DATA_TYPES,
	XP_OFFSETS,
	XP_TYPES,
	STATS_URL_BASE,
	type DungeonTypes,
	type SkillTypes,
	type SlayerTypes,
	type XPAndDataTypes,
	type XPOffsets,
} from '#constants';
import {
	escapeIgn,
	findSkyblockProfile,
	getLilyWeightRaw,
	getSenitherDungeonWeight,
	getSenitherSkillWeight,
	getSenitherSlayerWeight,
	getSkillLevel,
	getSlayerLevel,
	hours,
	isAbortError,
	minutes,
	safePromiseAll,
	seconds,
	trim,
	uuidToBustURL,
	validateDiscordId,
	validateNumber,
	weeks,
} from '#functions';
import { logger } from '#logger';
import { type LunarClient } from '#structures/LunarClient.js';
import { toUpperCase } from '#types';
import { EmbedUtil, GuildMemberUtil, GuildUtil, UserUtil, type RoleResolvables } from '#utils';

type PlayerFindOptions = FindOptions<Attributes<Player>>;

interface ParsedTransaction extends InferAttributes<Transaction> {
	fromIGN: string | null;
	toIGN: string | null;
}

export interface PlayerUpdateOptions {
	/**
	 * role update reason for discord's audit logs
	 */
	reason?: string;
	/**
	 * whether to reject if the hypixel API reponded with an error
	 */
	rejectOnAPIError?: boolean;
	/**
	 * whether to only await the updateXp call and not updateDiscordMember
	 */
	shouldOnlyAwaitUpdateXp?: boolean;
	/**
	 * whether to dm the user that they should include their ign somewhere in their nickname
	 */
	shouldSendDm?: boolean;
}

export interface TransferXpOptions {
	from?: XPOffsets;
	to?: XPOffsets;
	types?: readonly XPAndDataTypes[];
}

export interface ResetXpOptions {
	offsetToReset?: Offset.Current | Offset.Day | XPOffsets | null;
	typesToReset?: readonly XPAndDataTypes[];
}

interface SetToPaidOptions {
	/**
	 * paid amount
	 */
	amount?: number;
	/**
	 * hypixel auction uuid
	 */
	auctionId?: string | null;
	/**
	 * minecraft uuid of the player who collected
	 */
	collectedBy?: ModelResovable<TaxCollector>;
}

interface AddTransferOptions extends SetToPaidOptions {
	amount: number;
	collectedBy: ModelResovable<TaxCollector>;
	notes?: string | null;
	type?: TransactionType;
}

export type PlayerInGuild = Player & {
	guildId: string;
	hypixelGuild: HypixelGuild;
};

const enum NickChangeReason {
	NoIGN,
	NotUnique,
}

interface MakeNickAPICallOptions {
	/**
	 * new nickname, null to remove the current nickname
	 */
	newNick?: string | null;
	/**
	 * reason for discord's audit logs and the DM
	 */
	reason?: NickChangeReason | string;
	/**
	 * whether to dm the user that they should include their ign somewhere in their nickname
	 */
	shouldSendDm?: boolean;
}

export class Player extends Model<InferAttributes<Player>, InferCreationAttributes<Player>> {
	public declare readonly client: NonAttribute<LunarClient>;

	public declare minecraftUuid: string;

	public declare ign: CreationOptional<string>;

	public declare discordId: string | null;

	public declare inDiscord: CreationOptional<boolean>;

	public declare guildId: string | null;

	public declare guildRankPriority: CreationOptional<number>;

	public declare _infractions: number[] | null;

	public declare hasDiscordPingPermission: CreationOptional<boolean>;

	public declare notes: string | null;

	public declare paid: CreationOptional<boolean>;

	public declare mainProfileId: string | null;

	public declare mainProfileName: string | null;

	public declare xpLastUpdatedAt: Date | null;

	public declare xpUpdatesDisabled: CreationOptional<boolean>;

	public declare discordMemberUpdatesDisabled: CreationOptional<boolean>;

	public declare farmingLvlCap: CreationOptional<number>;

	public declare guildXpDay: string | null;

	public declare guildXpDaily: CreationOptional<number>;

	public declare lastActivityAt: CreationOptional<Date>;

	// current
	public declare tamingXp: CreationOptional<number>;

	public declare farmingXp: CreationOptional<number>;

	public declare miningXp: CreationOptional<number>;

	public declare combatXp: CreationOptional<number>;

	public declare foragingXp: CreationOptional<number>;

	public declare fishingXp: CreationOptional<number>;

	public declare enchantingXp: CreationOptional<number>;

	public declare alchemyXp: CreationOptional<number>;

	public declare carpentryXp: CreationOptional<number>;

	public declare runecraftingXp: CreationOptional<number>;

	public declare social2Xp: CreationOptional<number>;

	public declare zombieXp: CreationOptional<number>;

	public declare spiderXp: CreationOptional<number>;

	public declare wolfXp: CreationOptional<number>;

	public declare endermanXp: CreationOptional<number>;

	public declare blazeXp: CreationOptional<number>;

	public declare catacombsXp: CreationOptional<number>;

	public declare healerXp: CreationOptional<number>;

	public declare mageXp: CreationOptional<number>;

	public declare berserkXp: CreationOptional<number>;

	public declare archerXp: CreationOptional<number>;

	public declare tankXp: CreationOptional<number>;

	public declare guildXp: CreationOptional<number>;

	public declare catacombsCompletions: CreationOptional<Record<string, number>>;

	public declare catacombsMasterCompletions: CreationOptional<Record<string, number>>;

	// daily array
	public declare tamingXpHistory: CreationOptional<number[]>;

	public declare farmingXpHistory: CreationOptional<number[]>;

	public declare miningXpHistory: CreationOptional<number[]>;

	public declare combatXpHistory: CreationOptional<number[]>;

	public declare foragingXpHistory: CreationOptional<number[]>;

	public declare fishingXpHistory: CreationOptional<number[]>;

	public declare enchantingXpHistory: CreationOptional<number[]>;

	public declare alchemyXpHistory: CreationOptional<number[]>;

	public declare carpentryXpHistory: CreationOptional<number[]>;

	public declare runecraftingXpHistory: CreationOptional<number[]>;

	public declare social2XpHistory: CreationOptional<number[]>;

	public declare zombieXpHistory: CreationOptional<number[]>;

	public declare spiderXpHistory: CreationOptional<number[]>;

	public declare wolfXpHistory: CreationOptional<number[]>;

	public declare endermanXpHistory: CreationOptional<number[]>;

	public declare blazeXpHistory: CreationOptional<number[]>;

	public declare catacombsXpHistory: CreationOptional<number[]>;

	public declare healerXpHistory: CreationOptional<number[]>;

	public declare mageXpHistory: CreationOptional<number[]>;

	public declare berserkXpHistory: CreationOptional<number[]>;

	public declare archerXpHistory: CreationOptional<number[]>;

	public declare tankXpHistory: CreationOptional<number[]>;

	public declare guildXpHistory: CreationOptional<number[]>;

	public declare catacombsCompletionsHistory: CreationOptional<Record<string, number>[]>;

	public declare catacombsMasterCompletionsHistory: CreationOptional<Record<string, number>[]>;

	// competition start
	public declare tamingXpCompetitionStart: CreationOptional<number>;

	public declare farmingXpCompetitionStart: CreationOptional<number>;

	public declare miningXpCompetitionStart: CreationOptional<number>;

	public declare combatXpCompetitionStart: CreationOptional<number>;

	public declare foragingXpCompetitionStart: CreationOptional<number>;

	public declare fishingXpCompetitionStart: CreationOptional<number>;

	public declare enchantingXpCompetitionStart: CreationOptional<number>;

	public declare alchemyXpCompetitionStart: CreationOptional<number>;

	public declare carpentryXpCompetitionStart: CreationOptional<number>;

	public declare runecraftingXpCompetitionStart: CreationOptional<number>;

	public declare social2XpCompetitionStart: CreationOptional<number>;

	public declare zombieXpCompetitionStart: CreationOptional<number>;

	public declare spiderXpCompetitionStart: CreationOptional<number>;

	public declare wolfXpCompetitionStart: CreationOptional<number>;

	public declare endermanXpCompetitionStart: CreationOptional<number>;

	public declare blazeXpCompetitionStart: CreationOptional<number>;

	public declare catacombsXpCompetitionStart: CreationOptional<number>;

	public declare healerXpCompetitionStart: CreationOptional<number>;

	public declare mageXpCompetitionStart: CreationOptional<number>;

	public declare berserkXpCompetitionStart: CreationOptional<number>;

	public declare archerXpCompetitionStart: CreationOptional<number>;

	public declare tankXpCompetitionStart: CreationOptional<number>;

	public declare guildXpCompetitionStart: CreationOptional<number>;

	public declare catacombsCompletionsCompetitionStart: CreationOptional<Record<`${bigint}`, number>>;

	public declare catacombsMasterCompletionsCompetitionStart: CreationOptional<Record<`${bigint}`, number>>;

	// competition end
	public declare tamingXpCompetitionEnd: CreationOptional<number>;

	public declare farmingXpCompetitionEnd: CreationOptional<number>;

	public declare miningXpCompetitionEnd: CreationOptional<number>;

	public declare combatXpCompetitionEnd: CreationOptional<number>;

	public declare foragingXpCompetitionEnd: CreationOptional<number>;

	public declare fishingXpCompetitionEnd: CreationOptional<number>;

	public declare enchantingXpCompetitionEnd: CreationOptional<number>;

	public declare alchemyXpCompetitionEnd: CreationOptional<number>;

	public declare carpentryXpCompetitionEnd: CreationOptional<number>;

	public declare runecraftingXpCompetitionEnd: CreationOptional<number>;

	public declare social2XpCompetitionEnd: CreationOptional<number>;

	public declare zombieXpCompetitionEnd: CreationOptional<number>;

	public declare spiderXpCompetitionEnd: CreationOptional<number>;

	public declare wolfXpCompetitionEnd: CreationOptional<number>;

	public declare endermanXpCompetitionEnd: CreationOptional<number>;

	public declare blazeXpCompetitionEnd: CreationOptional<number>;

	public declare catacombsXpCompetitionEnd: CreationOptional<number>;

	public declare healerXpCompetitionEnd: CreationOptional<number>;

	public declare mageXpCompetitionEnd: CreationOptional<number>;

	public declare berserkXpCompetitionEnd: CreationOptional<number>;

	public declare archerXpCompetitionEnd: CreationOptional<number>;

	public declare tankXpCompetitionEnd: CreationOptional<number>;

	public declare guildXpCompetitionEnd: CreationOptional<number>;

	public declare catacombsCompletionsCompetitionEnd: CreationOptional<Record<`${bigint}`, number>>;

	public declare catacombsMasterCompletionsCompetitionEnd: CreationOptional<Record<`${bigint}`, number>>;

	// mayor
	public declare tamingXpOffsetMayor: CreationOptional<number>;

	public declare farmingXpOffsetMayor: CreationOptional<number>;

	public declare miningXpOffsetMayor: CreationOptional<number>;

	public declare combatXpOffsetMayor: CreationOptional<number>;

	public declare foragingXpOffsetMayor: CreationOptional<number>;

	public declare fishingXpOffsetMayor: CreationOptional<number>;

	public declare enchantingXpOffsetMayor: CreationOptional<number>;

	public declare alchemyXpOffsetMayor: CreationOptional<number>;

	public declare carpentryXpOffsetMayor: CreationOptional<number>;

	public declare runecraftingXpOffsetMayor: CreationOptional<number>;

	public declare social2XpOffsetMayor: CreationOptional<number>;

	public declare zombieXpOffsetMayor: CreationOptional<number>;

	public declare spiderXpOffsetMayor: CreationOptional<number>;

	public declare wolfXpOffsetMayor: CreationOptional<number>;

	public declare endermanXpOffsetMayor: CreationOptional<number>;

	public declare blazeXpOffsetMayor: CreationOptional<number>;

	public declare catacombsXpOffsetMayor: CreationOptional<number>;

	public declare healerXpOffsetMayor: CreationOptional<number>;

	public declare mageXpOffsetMayor: CreationOptional<number>;

	public declare berserkXpOffsetMayor: CreationOptional<number>;

	public declare archerXpOffsetMayor: CreationOptional<number>;

	public declare tankXpOffsetMayor: CreationOptional<number>;

	public declare guildXpOffsetMayor: CreationOptional<number>;

	public declare catacombsCompletionsOffsetMayor: CreationOptional<Record<`${bigint}`, number>>;

	public declare catacombsMasterCompletionsOffsetMayor: CreationOptional<Record<`${bigint}`, number>>;

	// week
	public declare tamingXpOffsetWeek: CreationOptional<number>;

	public declare farmingXpOffsetWeek: CreationOptional<number>;

	public declare miningXpOffsetWeek: CreationOptional<number>;

	public declare combatXpOffsetWeek: CreationOptional<number>;

	public declare foragingXpOffsetWeek: CreationOptional<number>;

	public declare fishingXpOffsetWeek: CreationOptional<number>;

	public declare enchantingXpOffsetWeek: CreationOptional<number>;

	public declare alchemyXpOffsetWeek: CreationOptional<number>;

	public declare carpentryXpOffsetWeek: CreationOptional<number>;

	public declare runecraftingXpOffsetWeek: CreationOptional<number>;

	public declare social2XpOffsetWeek: CreationOptional<number>;

	public declare zombieXpOffsetWeek: CreationOptional<number>;

	public declare spiderXpOffsetWeek: CreationOptional<number>;

	public declare wolfXpOffsetWeek: CreationOptional<number>;

	public declare endermanXpOffsetWeek: CreationOptional<number>;

	public declare blazeXpOffsetWeek: CreationOptional<number>;

	public declare catacombsXpOffsetWeek: CreationOptional<number>;

	public declare healerXpOffsetWeek: CreationOptional<number>;

	public declare mageXpOffsetWeek: CreationOptional<number>;

	public declare berserkXpOffsetWeek: CreationOptional<number>;

	public declare archerXpOffsetWeek: CreationOptional<number>;

	public declare tankXpOffsetWeek: CreationOptional<number>;

	public declare guildXpOffsetWeek: CreationOptional<number>;

	public declare catacombsCompletionsOffsetWeek: CreationOptional<Record<`${bigint}`, number>>;

	public declare catacombsMasterCompletionsOffsetWeek: CreationOptional<Record<`${bigint}`, number>>;

	// month
	public declare tamingXpOffsetMonth: CreationOptional<number>;

	public declare farmingXpOffsetMonth: CreationOptional<number>;

	public declare miningXpOffsetMonth: CreationOptional<number>;

	public declare combatXpOffsetMonth: CreationOptional<number>;

	public declare foragingXpOffsetMonth: CreationOptional<number>;

	public declare fishingXpOffsetMonth: CreationOptional<number>;

	public declare enchantingXpOffsetMonth: CreationOptional<number>;

	public declare alchemyXpOffsetMonth: CreationOptional<number>;

	public declare carpentryXpOffsetMonth: CreationOptional<number>;

	public declare runecraftingXpOffsetMonth: CreationOptional<number>;

	public declare social2XpOffsetMonth: CreationOptional<number>;

	public declare zombieXpOffsetMonth: CreationOptional<number>;

	public declare spiderXpOffsetMonth: CreationOptional<number>;

	public declare wolfXpOffsetMonth: CreationOptional<number>;

	public declare endermanXpOffsetMonth: CreationOptional<number>;

	public declare blazeXpOffsetMonth: CreationOptional<number>;

	public declare catacombsXpOffsetMonth: CreationOptional<number>;

	public declare healerXpOffsetMonth: CreationOptional<number>;

	public declare mageXpOffsetMonth: CreationOptional<number>;

	public declare berserkXpOffsetMonth: CreationOptional<number>;

	public declare archerXpOffsetMonth: CreationOptional<number>;

	public declare tankXpOffsetMonth: CreationOptional<number>;

	public declare guildXpOffsetMonth: CreationOptional<number>;

	public declare catacombsCompletionsOffsetMonth: CreationOptional<Record<`${bigint}`, number>>;

	public declare catacombsMasterCompletionsOffsetMonth: CreationOptional<Record<`${bigint}`, number>>;

	public declare readonly createdAt: CreationOptional<Date>;

	public declare readonly updatedAt: CreationOptional<Date>;

	/**
	 * linked guild member
	 */
	private _discordMember: GuildMember | null = null;

	public static initialise(sequelize: Sequelize) {
		const attributes = {} as Record<
			| `${ArrayElementType<typeof DUNGEON_TYPES>}Completions`
			| `${ArrayElementType<typeof DUNGEON_TYPES>}Completions${ArrayElementType<typeof XP_OFFSETS>}`
			| `${ArrayElementType<typeof DUNGEON_TYPES>}CompletionsHistory`
			| `${ArrayElementType<typeof DUNGEON_TYPES>}MasterCompletions`
			| `${ArrayElementType<typeof DUNGEON_TYPES>}MasterCompletions${ArrayElementType<typeof XP_OFFSETS>}`
			| `${ArrayElementType<typeof DUNGEON_TYPES>}MasterCompletionsHistory`
			| `${ArrayElementType<typeof XP_TYPES>}Xp`
			| `${ArrayElementType<typeof XP_TYPES>}Xp${ArrayElementType<typeof XP_OFFSETS>}`
			| `${ArrayElementType<typeof XP_TYPES>}XpHistory`,
			ModelAttributeColumnOptions<Player>
		>;

		// add xp types
		for (const type of XP_TYPES) {
			attributes[`${type}Xp`] = {
				type: DataTypes.DECIMAL,
				defaultValue: 0,
				allowNull: false,
			};

			attributes[`${type}XpHistory`] = {
				type: DataTypes.ARRAY(DataTypes.DECIMAL),
				defaultValue: Array.from({ length: 30 }, () => 0),
				allowNull: false,
			};

			for (const offset of XP_OFFSETS) {
				attributes[`${type}Xp${offset}`] = {
					type: DataTypes.DECIMAL,
					defaultValue: 0,
					allowNull: false,
				};
			}
		}

		// add dungeon completions
		for (const type of DUNGEON_TYPES) {
			attributes[`${type}Completions`] = {
				type: DataTypes.JSONB,
				defaultValue: {},
				allowNull: false,
			};

			attributes[`${type}MasterCompletions`] = {
				type: DataTypes.JSONB,
				defaultValue: {},
				allowNull: false,
			};

			attributes[`${type}CompletionsHistory`] = {
				type: DataTypes.ARRAY(DataTypes.JSONB),
				defaultValue: Array.from({ length: 30 }, () => ({})),
				allowNull: false,
			};

			attributes[`${type}MasterCompletionsHistory`] = {
				type: DataTypes.ARRAY(DataTypes.JSONB),
				defaultValue: Array.from({ length: 30 }, () => ({})),
				allowNull: false,
			};

			for (const offset of XP_OFFSETS) {
				attributes[`${type}Completions${offset}`] = {
					type: DataTypes.JSONB,
					defaultValue: {},
					allowNull: false,
				};

				attributes[`${type}MasterCompletions${offset}`] = {
					type: DataTypes.JSONB,
					defaultValue: {},
					allowNull: false,
				};
			}
		}

		return this.init(
			{
				// general information
				minecraftUuid: {
					type: DataTypes.TEXT,
					primaryKey: true,
				},
				ign: {
					type: DataTypes.TEXT,
					defaultValue: UNKNOWN_IGN,
					allowNull: false,
				},
				discordId: {
					type: DataTypes.TEXT,
					defaultValue: null,
					allowNull: true,
					set(value: Snowflake | null) {
						this.setDataValue('discordId', value);
						if (!value) (this as Player).inDiscord = false;
					},
				},
				inDiscord: {
					type: DataTypes.BOOLEAN,
					defaultValue: false,
					allowNull: false,
					set(value: boolean) {
						this.setDataValue('inDiscord', value);
						if (!value) void (this as Player).uncacheMember();
					},
				},
				guildId: {
					type: DataTypes.TEXT,
					defaultValue: null,
					allowNull: true,
				},
				guildRankPriority: {
					type: DataTypes.INTEGER,
					defaultValue: 0,
					allowNull: false,
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
					type: DataTypes.TEXT,
					defaultValue: null,
					allowNull: true,
				},
				mainProfileName: {
					type: DataTypes.TEXT,
					defaultValue: null,
					allowNull: true,
				},
				xpLastUpdatedAt: {
					type: DataTypes.DATE,
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
					type: DataTypes.TEXT,
					defaultValue: null,
					allowNull: true,
				},
				guildXpDaily: {
					type: DataTypes.INTEGER,
					defaultValue: 0,
					allowNull: false,
				},

				lastActivityAt: {
					type: DataTypes.DATE,
					defaultValue: fn('NOW'),
					allowNull: false,
				},

				createdAt: DataTypes.DATE,
				updatedAt: DataTypes.DATE,

				...attributes,
			},
			{
				sequelize,
				indexes: [
					{
						// setting unique down here works with `sync --alter`
						unique: true,
						fields: ['discordId'],
					},
				],
			},
		) as ModelStatic<Player>;
	}

	/**
	 * returns the number of infractions that have not already expired
	 */
	public get infractions(): NonAttribute<number> {
		if (!this._infractions) return 0;

		// last infraction expired -> remove all infractions
		if (this._infractions.at(-1)! + this.client.config.get('CHATBRIDGE_AUTOMUTE_DURATION') <= Date.now()) {
			this.update({ _infractions: null }).catch((error) => logger.error(error));
			return 0;
		}

		return this._infractions.length;
	}

	/**
	 * returns the hypixel guild db object associated with the player
	 */
	public get hypixelGuild(): NonAttribute<HypixelGuild | null> {
		return (
			this.client.hypixelGuilds.cache.get(this.guildId!) ??
			(this.guildId
				? (logger.warn(`[GET HYPIXEL GUILD]: ${this.ign}: no guild with the id '${this.guildId}' found`), null)
				: null)
		);
	}

	/**
	 * whether the player is in a cached hypixel guild
	 */
	public inGuild(): this is PlayerInGuild {
		return this.client.hypixelGuilds.cache.has(this.guildId!);
	}

	/**
	 * fetches the discord member if the discord id is valid and the player is in the hypixel guild's discord server
	 *
	 * @param guildResolvable
	 */
	public async fetchDiscordMember(guildResolvable?: GuildResolvable | null) {
		if (this._discordMember) return this._discordMember;
		if (!this.inDiscord || !validateDiscordId(this.discordId)) return null;

		try {
			let guild: Guild | null | undefined;

			if (guildResolvable) {
				guild = this.client.guilds.resolve(guildResolvable);

				if (!guild?.available) {
					logger.warn(this.logInfo, `[FETCH DISCORD MEMBER] discord guild ${guild ? 'unavailable' : 'uncached'}`);
					return null;
				}
			} else {
				guild = this.hypixelGuild?.discordGuild;

				if (!guild) return null;
			}

			const discordMember = await guild.members.fetch(this.discordId);

			void this.setDiscordMember(discordMember);

			return discordMember;
		} catch (error) {
			// prevent further fetches and try to link via cache in the next updateDiscordMember calls
			logger.error({ err: error, ...this.logInfo }, '[FETCH DISCORD MEMBER]');
			void this.setDiscordMember(null, error instanceof DiscordAPIError);
			return null;
		}
	}

	/**
	 * @param member - discord guild member linked to the player
	 * @param force
	 */
	public async setDiscordMember(member: GuildMember | null, force = false) {
		if (!member) {
			if (this._discordMember) {
				GuildMemberUtil.setPlayer(this._discordMember, null);
			}

			this._discordMember = null;

			if (force) {
				try {
					await this.update({ inDiscord: false });
				} catch (error) {
					logger.error(error);
				}
			}

			return this;
		}

		if (this.hypixelGuild?.discordId !== member.guild.id) return this;

		if (this._discordMember) {
			GuildMemberUtil.setPlayer(this._discordMember, null);
		}

		this._discordMember = member;

		GuildMemberUtil.setPlayer(member, this);

		if (!this.inDiscord) {
			try {
				await this.update({ inDiscord: true });
			} catch (error) {
				logger.error(error);
			}
		}

		return this;
	}

	/**
	 * fetches the discord user if the discord id is valid
	 */
	public async fetchDiscordUser() {
		return validateNumber(this.discordId) ? this.client.users.fetch(this.discordId) : null;
	}

	/**
	 * returns the guild rank of the player
	 */
	public get guildRank(): NonAttribute<GuildRank | null> {
		return this.hypixelGuild?.ranks.find(({ priority }) => priority === this.guildRankPriority) ?? null;
	}

	/**
	 * returns the player's guild name
	 */
	public get guildName(): NonAttribute<string> {
		return this.hypixelGuild?.name ?? (this.guildId === GUILD_ID_ERROR ? 'Error' : 'Unknown Guild');
	}

	/**
	 * returns a string with the ign and guild name
	 */
	public get info(): NonAttribute<string> {
		return `${hyperlink(escapeIgn(this.ign), this.url)} | ${this.guildName}` as const; // •
	}

	/**
	 * returns an object with the ign and guild name
	 */
	public get logInfo(): NonAttribute<Record<string, unknown>> {
		return { ign: this.ign, guild: this.guildName };
	}

	/**
	 * link with a bust url of the player's skin
	 */
	public get imageURL(): NonAttribute<ReturnType<typeof uuidToBustURL>> {
		return uuidToBustURL(this.minecraftUuid);
	}

	/**
	 * returns a sky.shiiyu.moe link for the player
	 */
	public get url(): NonAttribute<string> {
		return `${STATS_URL_BASE}${this.ign === UNKNOWN_IGN ? this.minecraftUuid : this.ign}/${
			this.mainProfileName ?? ''
		}` as const;
	}

	/**
	 * whether the player has an in-game staff rank in their current hypixel guild
	 */
	public get isStaff(): NonAttribute<boolean> {
		const { hypixelGuild } = this;
		if (!hypixelGuild) return false;
		return this.guildRankPriority > hypixelGuild.ranks.length - hypixelGuild.staffRanksAmount;
	}

	/**
	 * amount of the last tax transaction from that player
	 */
	public async fetchLastTaxAmount() {
		const result = await this.client.db.models.Transaction.findAll({
			limit: 1,
			where: {
				from: this.minecraftUuid,
				type: TransactionType.Tax,
			},
			order: [['createdAt', 'DESC']],
			attributes: ['amount'],
			raw: true,
		});

		return result[0]?.amount ?? null;
	}

	/**
	 * all transactions from that player
	 */
	public async fetchTransactions(
		options: PlayerFindOptions & { parse: false },
	): Promise<InferAttributes<Transaction>[]>;
	public async fetchTransactions(options?: PlayerFindOptions & { parse?: boolean }): Promise<ParsedTransaction[]>;
	public async fetchTransactions({ parse = true, ...options }: PlayerFindOptions & { parse?: boolean } = {}) {
		const data = await this.client.db.models.Transaction.findAll({
			where: {
				from: this.minecraftUuid,
			},
			order: [['createdAt', 'DESC']],
			raw: true,
			...options,
		});

		if (!parse) return data;

		return Promise.all(
			data.map(async (transaction) => ({
				...transaction,
				fromIGN: this.ign,
				toIGN:
					(
						this.client.players.cache.get(transaction.to) ??
						(await mojang.uuid(transaction.to).catch((error) => logger.error(error)))
					)?.ign ?? transaction.to,
			})),
		) as Promise<ParsedTransaction[]>;
	}

	/**
	 * updates the player data and discord member
	 *
	 * @param options
	 */
	public async updateData({
		reason = 'synced with in-game stats',
		shouldSendDm = false,
		shouldOnlyAwaitUpdateXp = false,
		rejectOnAPIError = false,
	}: PlayerUpdateOptions = {}) {
		// uncache non guild members if no activity in the last hour
		if (!this.guildId && !this.client.taxCollectors.cache.get(this.minecraftUuid)?.isCollecting) {
			if (Date.now() - this.lastActivityAt.getTime() >= hours(1)) void this.uncache();
			return this;
		}

		if (this.guildId !== GUILD_ID_ERROR) await this.updateXp(rejectOnAPIError); // only query hypixel skyblock api for guild players without errors

		if (shouldOnlyAwaitUpdateXp) {
			this.updateDiscordMember({ reason, shouldSendDm }).catch((error) =>
				logger.error({ err: error, ...this.logInfo }, '[UPDATE DATA]'),
			);
		} else {
			await this.updateDiscordMember({ reason, shouldSendDm });
		}

		return this;
	}

	/**
	 * updates skill and slayer xp
	 *
	 * @param rejectOnAPIError
	 */
	public async updateXp(rejectOnAPIError = false) {
		if (this.xpUpdatesDisabled) return this;

		try {
			if (!this.mainProfileId) await this.fetchMainProfile(); // detect main profile if it is unknown

			// hypixel API call
			const playerData = (await hypixel.skyblock.profile(this.mainProfileId!)).profile?.members?.[this.minecraftUuid];

			if (!playerData) {
				this.update({ mainProfileId: null }).catch((error) => logger.error(error));
				throw `unable to find main profile named '${this.mainProfileName}' -> resetting name`;
			}

			this.xpLastUpdatedAt = new Date();

			/**
			 * SKILLS
			 */
			if (Reflect.has(playerData, 'experience_skill_mining')) {
				for (const skill of SKILLS) this[`${skill}Xp`] = playerData[`experience_skill_${skill}`] ?? 0;
				for (const skill of COSMETIC_SKILLS) this[`${skill}Xp`] = playerData[`experience_skill_${skill}`] ?? 0;

				// reset skill xp if no taming xp offset
				if (this.tamingXp !== 0) {
					for (const offset of XP_OFFSETS) {
						if (this[`tamingXp${offset}`] === 0) {
							logger.info({ ...this.logInfo, offset }, '[UPDATE XP]: resetting skill xp');
							await this.resetXp({ offsetToReset: offset, typesToReset: [...SKILLS, ...COSMETIC_SKILLS] });
						}
					}
				}
			} else {
				// log once every hour (during the first update)
				if (!new Date().getHours() && new Date().getMinutes() < this.client.config.get('DATABASE_UPDATE_INTERVAL')) {
					logger.warn(this.logInfo, '[UPDATE XP]: skill API disabled');
				}

				this.notes = 'skill api disabled';

				/**
				 * request achievements api
				 */
				const { player } = await hypixel.player.uuid(this.minecraftUuid);

				if (player?.achievements) {
					for (const skill of SKILLS) {
						this[`${skill}Xp`] = SKILL_XP_TOTAL[player.achievements[SKILL_ACHIEVEMENTS[skill]] ?? 0] ?? 0;
					}
				}
			}

			this.farmingLvlCap = 50 + (playerData.jacob2?.perks?.farming_level_cap ?? 0);

			/**
			 * slayer
			 */
			for (const slayer of SLAYERS) this[`${slayer}Xp`] = playerData.slayer_bosses?.[slayer]?.xp ?? 0;

			// reset slayer xp if no zombie xp offset
			if (this.zombieXp !== 0) {
				for (const offset of XP_OFFSETS) {
					if (this[`zombieXp${offset}`] === 0) {
						logger.info({ ...this.logInfo, offset }, '[UPDATE XP]: resetting slayer xp');
						await this.resetXp({ offsetToReset: offset, typesToReset: SLAYERS });
					}
				}
			}

			// no slayer data found logging
			if (
				!Reflect.has(playerData.slayer_bosses?.zombie ?? {}, 'xp') &&
				!new Date().getHours() &&
				new Date().getMinutes() < this.client.config.get('DATABASE_UPDATE_INTERVAL')
			) {
				logger.warn(this.logInfo, '[UPDATE XP]: no slayer data found');
			}

			/**
			 * dungeons
			 */
			for (const dungeonType of DUNGEON_TYPES) {
				this[`${dungeonType}Xp`] = playerData.dungeons?.dungeon_types?.[dungeonType]?.experience ?? 0;
				this[`${dungeonType}Completions`] = playerData.dungeons?.dungeon_types?.[dungeonType]?.tier_completions ?? {};
				this[`${dungeonType}MasterCompletions`] =
					playerData.dungeons?.dungeon_types?.[`master_${dungeonType}`]?.tier_completions ?? {};
			}

			for (const dungeonClass of DUNGEON_CLASSES) {
				this[`${dungeonClass}Xp`] = playerData.dungeons?.player_classes?.[dungeonClass]?.experience ?? 0;
			}

			// reset dungeons xp if no catacombs xp offset
			if (this.catacombsXp !== 0) {
				for (const offset of XP_OFFSETS) {
					if (this[`catacombsXp${offset}`] === 0) {
						logger.info({ ...this.logInfo, offset }, '[UPDATE XP]: resetting dungeon xp');
						await this.resetXp({
							offsetToReset: offset,
							typesToReset: [
								...DUNGEON_TYPES_AND_CLASSES,
								...DUNGEON_TYPES.flatMap((type) => [`${type}Completions`, `${type}MasterCompletions`] as const),
							],
						});
					}
				}
			}

			// no dungeons data found logging
			if (
				!Reflect.has(playerData.dungeons?.dungeon_types?.catacombs ?? {}, 'experience') &&
				!new Date().getHours() &&
				new Date().getMinutes() < this.client.config.get('DATABASE_UPDATE_INTERVAL')
			) {
				logger.warn(this.logInfo, '[UPDATE XP]: no dungeons data found');
			}

			/**
			 * collections
			 */
			if (
				!Reflect.has(playerData, 'collection') &&
				!new Date().getHours() &&
				new Date().getMinutes() < this.client.config.get('DATABASE_UPDATE_INTERVAL')
			) {
				logger.warn(this.logInfo, '[UPDATE XP]: collections API disabled');
			}

			return await this.save();
		} catch (error) {
			if (typeof error === 'string') {
				logger.error(this.logInfo, `[UPDATE XP]: ${error}`);
				return this;
			}

			logger.error({ err: error, ...this.logInfo }, '[UPDATE XP]');

			if (error instanceof Error && error.name.startsWith('Sequelize')) return this;

			if (!(error instanceof RateLimitError)) void this.client.config.set('HYPIXEL_SKYBLOCK_API_ERROR', true);
			if (rejectOnAPIError) throw error;
			return this;
		}
	}

	/**
	 * updates discord roles and nickname
	 * can only reject if `this.guildId === GUILD_ID_ERROR`
	 *
	 * @param options
	 * @param options.reason role update reason for discord's audit logs
	 * @param options.shouldSendDm whether to dm the user that they should include their ign somewhere in their nickname
	 */
	public async updateDiscordMember({ reason: reasonInput = 'synced with in-game stats', shouldSendDm = false } = {}) {
		if (this.discordMemberUpdatesDisabled || !this.guildId) return this;

		let reason = reasonInput;

		const member =
			(await this.fetchDiscordMember()) ?? ((reason = 'found linked discord tag'), await this._linkUsingCache());

		// player left the guild but discord member couldn't be updated for some reason
		if (this.guildId === GUILD_ID_ERROR) {
			await this.removeFromGuild();
			return this;
		}

		if (!member) return this; // no linked available discord member to update

		// timeout expires before the next update
		const TIMEOUT_LEFT = (member.communicationDisabledUntilTimestamp ?? 0) - Date.now();

		if (TIMEOUT_LEFT >= 0 && TIMEOUT_LEFT <= 2 * this.client.config.get('DATABASE_UPDATE_INTERVAL') * minutes(1)) {
			void this.hypixelGuild?.unmute(this, member.communicationDisabledUntilTimestamp! - Date.now() + seconds(1));
		}

		// abort if the member is missing the mandatory role (if existant)
		const MANDATORY_ROLE_ID = this.client.discordGuilds.cache.get(member.guild.id)?.MANDATORY_ROLE_ID;

		if (MANDATORY_ROLE_ID && !member.roles.cache.has(MANDATORY_ROLE_ID)) {
			logger.warn(
				{ ...this.logInfo, userId: member.id, tag: member.user.tag },
				'[UPDATE DISCORD MEMBER]: missing mandatory role',
			);
			return this;
		}

		// actual update(s)
		await this.updateRoles(reason);
		await this.syncIgnWithDisplayName(shouldSendDm);
		return this;
	}

	/**
	 * updates the skyblock related discord roles using the db data
	 *
	 * @param reasonInput reason for discord's audit logs
	 */
	public async updateRoles(reasonInput?: string) {
		const member = await this.fetchDiscordMember();
		if (!member) return this;

		const discordGuild = this.client.discordGuilds.cache.get(member.guild.id);
		if (!discordGuild) return this;

		const { cache: roleCache, highest: highestRole } = member.roles;
		const rolesToAdd: Snowflake[] = [];
		const rolesToRemove: Snowflake[] = [];
		const { totalWeight: weight } = this.getLilyWeight();

		let reason = reasonInput;

		for (const hypixelGuildId of discordGuild.hypixelGuildIds) {
			const hypixelGuild = this.client.hypixelGuilds.cache.get(hypixelGuildId);
			if (!hypixelGuild) continue;

			// player is in the guild
			if (hypixelGuild.guildId === this.guildId) {
				if (hypixelGuild.GUILD_ROLE_ID && !roleCache.has(hypixelGuild.GUILD_ROLE_ID)) {
					rolesToAdd.push(hypixelGuild.GUILD_ROLE_ID);
				}

				if (roleCache.has(hypixelGuild.EX_GUILD_ROLE_ID!)) rolesToRemove.push(hypixelGuild.EX_GUILD_ROLE_ID!);

				// rank roles
				const CURRENT_PRIORITY =
					hypixelGuild.checkStaff(this) && hypixelGuild.syncRanksEnabled
						? hypixelGuild.ranks
								// filter out non-automated ranks
								.filter(({ currentWeightReq }) => currentWeightReq !== null)
								// sort descendingly by weight req
								.sort(({ currentWeightReq: a }, { currentWeightReq: b }) => b! - a!)
								// find first rank that the player is eligable for
								.find(({ currentWeightReq }) => weight >= currentWeightReq!)?.priority
						: this.guildRankPriority;

				for (const { roleId, priority } of hypixelGuild.ranks) {
					if (!roleId) continue;

					if (priority !== this.guildRankPriority && priority !== CURRENT_PRIORITY) {
						if (roleCache.has(roleId)) {
							rolesToRemove.push(roleId);
							reason = 'synced with in-game rank';
						}
					} else if (!roleCache.has(roleId)) {
						rolesToAdd.push(roleId);
						reason = 'synced with in-game rank';
					}
				}
			} else {
				// player is not in the guild -> remove all roles
				// guild role
				if (roleCache.has(hypixelGuild.GUILD_ROLE_ID!)) rolesToRemove.push(hypixelGuild.GUILD_ROLE_ID!);

				// rank roles
				for (const { roleId } of hypixelGuild.ranks) {
					if (roleId && roleCache.has(roleId)) rolesToRemove.push(roleId);
				}
			}
		}

		// guild roles
		if (discordGuild.GUILD_ROLE_ID && !roleCache.has(discordGuild.GUILD_ROLE_ID)) {
			rolesToAdd.push(discordGuild.GUILD_ROLE_ID);
		}

		// guild delimiter role (only if it doesn't overwrite current colour role, delimiters have invis colour)
		if (
			(member.guild.roles.cache.get(discordGuild.GUILD_DELIMITER_ROLE_ID!)?.comparePositionTo(highestRole) ?? 0) < 0
		) {
			// current highest role is higher
			if (!roleCache.has(discordGuild.GUILD_DELIMITER_ROLE_ID!)) rolesToAdd.push(discordGuild.GUILD_DELIMITER_ROLE_ID!);
		} else if (roleCache.has(discordGuild.GUILD_DELIMITER_ROLE_ID!)) {
			rolesToRemove.push(discordGuild.GUILD_DELIMITER_ROLE_ID!);
		}

		// other delimiter roles
		for (let index = 1; index < DELIMITER_ROLES.length; ++index) {
			if (
				discordGuild[`${DELIMITER_ROLES[index]!}_DELIMITER_ROLE_ID`] &&
				!roleCache.has(discordGuild[`${DELIMITER_ROLES[index]!}_DELIMITER_ROLE_ID`]!)
			) {
				rolesToAdd.push(discordGuild[`${DELIMITER_ROLES[index]!}_DELIMITER_ROLE_ID`]!);
			}
		}

		// skills
		const skillAverage =
			SKILLS.map((skill) => {
				// individual skill lvl 45+ / 50+ / 55+ / 60
				const { progressLevel } = this.getSkillLevel(skill);
				const CURRENT_LEVEL_MILESTONE = Math.trunc(progressLevel / 5) * 5; // round down to nearest divisible by 5
				const SKILL = toUpperCase(skill);

				// individual skills
				for (const level of SKILL_ROLES) {
					if (level === CURRENT_LEVEL_MILESTONE) {
						if (
							discordGuild[`${SKILL}_${level}_ROLE_ID`] &&
							!roleCache.has(discordGuild[`${SKILL}_${level}_ROLE_ID`]!)
						) {
							rolesToAdd.push(discordGuild[`${SKILL}_${level}_ROLE_ID`]!);
						}
					} else if (roleCache.has(discordGuild[`${SKILL}_${level}_ROLE_ID`]!)) {
						rolesToRemove.push(discordGuild[`${SKILL}_${level}_ROLE_ID`]!);
					}
				}

				return progressLevel;
			}).reduce((acc, level) => acc + level, 0) / SKILLS.length;

		// average skill
		let currentLvlMilestone = Math.trunc(skillAverage / 5) * 5; // round down to nearest divisible by 5

		for (const level of SKILL_AVERAGE_ROLES) {
			if (level === currentLvlMilestone) {
				if (!roleCache.has(discordGuild[`AVERAGE_LVL_${level}_ROLE_ID`]!)) {
					rolesToAdd.push(discordGuild[`AVERAGE_LVL_${level}_ROLE_ID`]!);
				}
			} else if (roleCache.has(discordGuild[`AVERAGE_LVL_${level}_ROLE_ID`]!)) {
				rolesToRemove.push(discordGuild[`AVERAGE_LVL_${level}_ROLE_ID`]!);
			}
		}

		// slayers
		const LOWEST_SLAYER_LVL = Math.min(
			...SLAYERS.map((slayer) => {
				const SLAYER_LVL = this.getSlayerLevel(slayer);
				const SLAYER = toUpperCase(slayer);

				// individual slayer
				for (const level of SLAYER_ROLES) {
					if (level === SLAYER_LVL) {
						if (!roleCache.has(discordGuild[`${SLAYER}_${level}_ROLE_ID`]!)) {
							rolesToAdd.push(discordGuild[`${SLAYER}_${level}_ROLE_ID`]!);
						}
					} else if (roleCache.has(discordGuild[`${SLAYER}_${level}_ROLE_ID`]!)) {
						rolesToRemove.push(discordGuild[`${SLAYER}_${level}_ROLE_ID`]!);
					}
				}

				return SLAYER_LVL;
			}),
		);

		// total slayer
		for (const level of SLAYER_TOTAL_ROLES) {
			if (level === LOWEST_SLAYER_LVL) {
				if (!roleCache.has(discordGuild[`SLAYER_ALL_${level}_ROLE_ID`]!)) {
					rolesToAdd.push(discordGuild[`SLAYER_ALL_${level}_ROLE_ID`]!);
				}
			} else if (roleCache.has(discordGuild[`SLAYER_ALL_${level}_ROLE_ID`]!)) {
				rolesToRemove.push(discordGuild[`SLAYER_ALL_${level}_ROLE_ID`]!);
			}
		}

		// dungeons
		currentLvlMilestone = Math.trunc(this.getSkillLevel('catacombs').trueLevel / 5) * 5; // round down to nearest divisible by 5

		for (const level of CATACOMBS_ROLES) {
			if (level === currentLvlMilestone) {
				if (!roleCache.has(discordGuild[`CATACOMBS_${level}_ROLE_ID`]!)) {
					rolesToAdd.push(discordGuild[`CATACOMBS_${level}_ROLE_ID`]!);
				}
			} else if (roleCache.has(discordGuild[`CATACOMBS_${level}_ROLE_ID`]!)) {
				rolesToRemove.push(discordGuild[`CATACOMBS_${level}_ROLE_ID`]!);
			}
		}

		// weight
		if (discordGuild.weightRoleIds) {
			for (const { weightReq, roleId } of discordGuild.weightRoleIds) {
				if (weight >= weightReq) {
					if (!roleCache.has(roleId)) rolesToAdd.push(roleId);
				} else if (roleCache.has(roleId)) {
					rolesToRemove.push(roleId);
				}
			}
		}

		// activity
		if (Date.now() - this.lastActivityAt.getTime() > this.client.config.get('INACTIVE_ROLE_TIME')) {
			if (!roleCache.has(discordGuild.INACTIVE_ROLE_ID!)) rolesToAdd.push(discordGuild.INACTIVE_ROLE_ID!);
		} else if (roleCache.has(discordGuild.INACTIVE_ROLE_ID!)) {
			rolesToRemove.push(discordGuild.INACTIVE_ROLE_ID!);
		}

		// api call
		return this.makeRoleAPICall({ rolesToAdd, rolesToRemove, reason });
	}

	/**
	 * tries to link unlinked players via discord.js-cache (without any discord API calls)
	 */
	private async _linkUsingCache() {
		const discordGuild = this.hypixelGuild?.discordGuild;
		if (!discordGuild) return null;

		let member: GuildMember | undefined;

		if (this.discordId) {
			// tag or ID known
			member = /\D/.test(this.discordId)
				? discordGuild.members.cache.find(({ user: { tag } }) => tag === this.discordId) // tag known
				: discordGuild.members.cache.get(this.discordId); // id known

			if (!member && !this.client.config.get('HYPIXEL_API_ERROR')) {
				const DISCORD_TAG = await this.fetchDiscordTag();

				if (!DISCORD_TAG) return null;

				member = discordGuild.members.cache.find(({ user: { tag } }) => tag === DISCORD_TAG);
			}
		} else if (!this.client.config.get('HYPIXEL_API_ERROR')) {
			// unknown tag
			const DISCORD_TAG = await this.fetchDiscordTag();

			if (!DISCORD_TAG) return null;

			member = discordGuild.members.cache.find(({ user: { tag } }) => tag === DISCORD_TAG);
		}

		if (!member) return null;

		// catch potential sequelize errors propagated from setUniqueDiscordId
		try {
			await this.link(member);

			logger.info(
				{ ...this.logInfo, discordId: member.id, tag: member.user.tag },
				'[LINK USING CACHE]: discord data found',
			);
		} catch (error) {
			const isUniqueConstraintError = error instanceof UniqueConstraintError;

			logger[isUniqueConstraintError ? 'warn' : 'error'](
				{
					err: isUniqueConstraintError ? undefined : error,
					...this.logInfo,
					discordId: member.id,
					tag: member.user.tag,
				},
				'[LINK USING CACHE]: linking error',
			);
		}

		return member;
	}

	/**
	 * validates the discordId and only updates it if the validation passes
	 *
	 * @param value
	 */
	public async setUniqueDiscordId(value: string | null, rejectOnError: boolean) {
		try {
			// use the static method because this.update sets the value temporarily in case of an exception
			await Player.update(
				{
					discordId: value,
				},
				{
					where: { minecraftUuid: this.minecraftUuid },
				},
			);

			// update local instance if the update method didn't reject
			this.discordId = value;
		} catch (error) {
			if (rejectOnError) throw error;

			logger.error(
				{
					err: error instanceof UniqueConstraintError ? undefined : error,
					...this.logInfo,
					old: this.discordId,
					new: value,
				},
				'[SET UNIQUE DISCORD ID]',
			);
		}
	}

	/**
	 * links a player to the provided discord guild member, updating roles and nickname
	 *
	 * @param idOrDiscordMember the member to link the player to
	 * @param reason reason for discord's audit logs
	 */
	public async link(idOrDiscordMember: GuildMember | Snowflake, reason?: string) {
		if (idOrDiscordMember instanceof GuildMember) {
			await this.setUniqueDiscordId(idOrDiscordMember.id, true);

			if (this.hypixelGuild?.discordId === idOrDiscordMember.guild.id) {
				this.update({ inDiscord: true }).catch((error) => logger.error({ err: error, ...this.logInfo }, '[LINK]'));
				void this.setDiscordMember(idOrDiscordMember);

				if (reason) await this.updateData({ reason });
			}

			logger.info(
				{ ...this.logInfo, discordId: idOrDiscordMember.id, tag: idOrDiscordMember.user.tag },
				'[LINK]: linked',
			);

			return this;
		}

		if (typeof idOrDiscordMember === 'string' && validateNumber(idOrDiscordMember)) {
			await this.setUniqueDiscordId(idOrDiscordMember, true);
			return this.update({ inDiscord: false });
		}

		throw new TypeError(
			`Input must be either a discord GuildMember or a discord ID, received '${idOrDiscordMember}' (${typeof idOrDiscordMember})`,
		);
	}

	/**
	 * unlinks a player from a discord member, purging roles and nickname
	 *
	 * @param reason reason for discord's audit logs
	 */
	public async unlink(reason?: string) {
		const currentlyLinkedMember = await this.fetchDiscordMember();

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

		// uncaches the discord member
		this.discordId = null;

		await this.save();

		return wasSuccessful;
	}

	/**
	 * adds and/or removes the provided roles and logs it via the log handler, returns true or false depending on the success
	 *
	 * @param options.rolesToAdd roles to add to the member
	 * @param options.rolesToRemove roles to remove from the member
	 * @param options.reason reason for discord's audit logs
	 */
	public async makeRoleAPICall({
		rolesToAdd = [],
		rolesToRemove = [],
		reason,
	}: {
		reason?: string;
		rolesToAdd?: RoleResolvables;
		rolesToRemove?: RoleResolvables;
	}) {
		const member = await this.fetchDiscordMember();
		if (!member) return false;

		// check if IDs are proper roles and managable by the bot
		const _rolesToAdd = GuildUtil.resolveRoles(member.guild, rolesToAdd);
		const _rolesToRemove = GuildUtil.resolveRoles(member.guild, rolesToRemove);

		if (!_rolesToAdd.length && !_rolesToRemove.length) return true;

		// permission check
		if (!member.guild.members.me!.permissions.has(PermissionFlagsBits.ManageRoles)) {
			logger.warn(`[ROLE API CALL]: missing 'MANAGE_ROLES' in '${member.guild.name}'`);
			return false;
		}

		const { config } = this.client;
		const loggingEmbed = new EmbedBuilder()
			.setAuthor({ name: member.user.tag, iconURL: member.displayAvatarURL(), url: this.url })
			.setThumbnail(this.imageURL)
			.setDescription(
				stripIndents`
					${bold('Role Update')} for ${member}
					${this.info}
				`,
			)
			.setTimestamp();
		const NAMES_TO_ADD = _rolesToAdd.length ? codeBlock(_rolesToAdd.map(({ name }) => name).join('\n')) : null;
		const NAMES_TO_REMOVE = _rolesToRemove.length ? codeBlock(_rolesToRemove.map(({ name }) => name).join('\n')) : null;
		const GUILD_ROLE_ID = this.client.discordGuilds.cache.get(member.guild.id)?.GUILD_ROLE_ID;
		const GUILD_2_ROLE_ID = this.hypixelGuild?.GUILD_ROLE_ID;
		const IS_ADDING_GUILD_ROLE = _rolesToAdd.some(({ id }) => id === GUILD_ROLE_ID || id === GUILD_2_ROLE_ID);

		for (const role of member.roles.cache.values()) {
			if (_rolesToRemove.some(({ id }) => role.id === id)) continue;
			_rolesToAdd.push(role);
		}

		try {
			// api call
			await member.roles.set(_rolesToAdd, reason);

			if (NAMES_TO_ADD) {
				loggingEmbed.addFields({
					name: 'Added',
					value: NAMES_TO_ADD,
					inline: true,
				});
			}

			if (NAMES_TO_REMOVE) {
				loggingEmbed.addFields({
					name: 'Removed',
					value: NAMES_TO_REMOVE,
					inline: true,
				});
			}

			// was successful
			loggingEmbed.setColor(IS_ADDING_GUILD_ROLE ? config.get('EMBED_GREEN') : config.get('EMBED_BLUE'));

			return true;
		} catch (error) {
			// was not successful
			logger.error(error, '[ROLE API CALL]');

			void this.setDiscordMember(null, error instanceof DiscordAPIError);

			loggingEmbed //
				.setColor(config.get('EMBED_RED'))
				.addFields(
					error instanceof Error
						? {
								name: error.name,
								value: error.message,
						  }
						: {
								name: 'Error',
								value: `${error}`,
						  },
				);

			if (NAMES_TO_ADD) {
				loggingEmbed.addFields({
					name: 'Failed to add',
					value: NAMES_TO_ADD,
					inline: true,
				});
			}

			if (NAMES_TO_REMOVE) {
				loggingEmbed.addFields({
					name: 'Failed to remove',
					value: NAMES_TO_REMOVE,
					inline: true,
				});
			}

			return false;
		} finally {
			// logging
			void this.client.log(EmbedUtil.padFields(loggingEmbed, 2));
		}
	}

	/**
	 * removes the discord server in-game guild role & all roles handled automatically by the bot
	 */
	public async removeFromGuild() {
		void this.client.taxCollectors.setInactive(this.minecraftUuid).catch((error) => logger.error(error));

		const member = await this.fetchDiscordMember();

		if (member) {
			const EX_GUILD_ROLE_ID = this.hypixelGuild?.EX_GUILD_ROLE_ID;
			const rolesToAdd =
				EX_GUILD_ROLE_ID &&
				Date.now() - this.createdAt.getTime() >= weeks(1) &&
				!member.roles.cache.has(EX_GUILD_ROLE_ID)
					? [EX_GUILD_ROLE_ID] // add ex guild role if player stayed for more than 1 week
					: [];
			const rolesToRemove = GuildMemberUtil.getRolesToPurge(member);

			this.client.hypixelGuilds.sweepPlayerCache(this.guildId);

			if (!(await this.makeRoleAPICall({ rolesToAdd, rolesToRemove, reason: `left ${this.guildName}` }))) {
				// error updating roles
				logger.warn(this.logInfo, '[REMOVE FROM GUILD]: unable to update roles');
				this.update({ guildId: GUILD_ID_ERROR }).catch((error) =>
					logger.error({ err: error, ...this.logInfo }, 'REMOVE FROM GUILD'),
				);
				return false;
			}

			// keep entry in cache but uncache discord member
			void this.uncacheMember();
		} else {
			logger.info(this.logInfo, '[REMOVE FROM GUILD]: left without being in the discord');

			// no linked member -> uncache entry
			await this.uncache();
		}

		await this.update({
			guildId: null,
			guildRankPriority: 0,
		});

		return true;
	}

	/**
	 * check if the discord member's display name includes the player ign and is unique. Tries to change it if it doesn't / isn't
	 *
	 * @param shouldSendDm - whether to dm the user that they should include their ign somewhere in their nickname
	 */
	public async syncIgnWithDisplayName(shouldSendDm = false) {
		if (!this.inGuild() || this.guildRankPriority > this.hypixelGuild.syncIgnThreshold) return this;

		const member = await this.fetchDiscordMember();
		if (!member) return this;

		let reason: NickChangeReason | null = null;

		// nickname doesn't include ign
		if (!member.displayName.toLowerCase().includes(this.ign.toLowerCase())) {
			reason = NickChangeReason.NoIGN;
		}

		// two guild members share the same display name
		const DISPLAY_NAME = member.displayName.toLowerCase();
		if (
			GuildMemberUtil.getPlayer(
				member.guild.members.cache.find(
					({ displayName, id }) => displayName.toLowerCase() === DISPLAY_NAME && id !== member.id,
				),
			)
		) {
			reason = NickChangeReason.NotUnique;
		}

		if (reason === null) return this;
		if (this.ign === UNKNOWN_IGN) return this; // mojang api error

		// check if member already has a nick which is not just the current ign (case insensitive)
		let newNick =
			member.nickname && member.nickname.toLowerCase() !== this.ign.toLowerCase()
				? `${trim(member.nickname, GuildMemberLimits.MaximumDisplayNameLength - this.ign.length - ' ()'.length).replace(
						/ +(?:\([^ )]*?)?\.{3}$/,
						'',
				  )} (${this.ign})`
				: this.ign;

		// 'nick (ign)' already exists
		if (
			GuildMemberUtil.getPlayer(
				member.guild.members.cache.find(
					({ displayName, id }) => displayName.toLowerCase() === newNick.toLowerCase() && id !== member.id,
				),
			)
		) {
			newNick = this.ign;
		}

		return this.makeNickAPICall({ newNick, shouldSendDm, reason });
	}

	/**
	 * sets a nickname for the player's discord member
	 *
	 * @param options
	 */
	public async makeNickAPICall({ newNick = null, shouldSendDm = false, reason }: MakeNickAPICallOptions = {}) {
		const member = await this.fetchDiscordMember();
		if (!member) return false;

		// permission checks
		const { me } = member.guild.members;
		if (me!.roles.highest.comparePositionTo(member.roles.highest) < 1) return false; // member's highest role is above bot's highest role
		if (member.guild.ownerId === member.id) return false; // can't change nick of owner
		if (!me!.permissions.has(PermissionFlagsBits.ManageNicknames)) {
			logger.warn(
				{ guildId: member.guild.id, guildName: member.guild.name, ...this.logInfo },
				"[SYNC IGN DISPLAYNAME]: missing 'ManageNicknames'",
			);
			return false;
		}

		const { displayName: PREV_NAME } = member;

		try {
			let auditLogReason: string | undefined;

			switch (reason) {
				case NickChangeReason.NoIGN:
					auditLogReason = "name didn't contain ign";
					break;

				case NickChangeReason.NotUnique:
					auditLogReason = 'name already taken';
					break;

				default:
					auditLogReason = reason;
			}

			await member.setNickname(newNick, auditLogReason);

			void this.client.log(
				this.client.defaultEmbed
					.setAuthor({ name: member.user.tag, iconURL: member.displayAvatarURL(), url: this.url })
					.setThumbnail(this.imageURL)
					.setDescription(
						stripIndents`
							${bold('Nickname Update')} for ${member}
							${this.info}
						`,
					)
					.addFields(
						{
							name: 'Old nickname',
							value: codeBlock(PREV_NAME),
							inline: true,
						},
						{
							name: 'New nickname',
							value: codeBlock(newNick ?? member.user.username),
							inline: true,
						},
					),
			);

			if (shouldSendDm) {
				switch (reason) {
					case NickChangeReason.NoIGN:
						void GuildMemberUtil.sendDM(member, {
							content: stripIndents`
								include your ign \`${this.ign}\` somewhere in your nickname.
								If you just changed your ign, wait up to ${this.client.config.get('DATABASE_UPDATE_INTERVAL')} minutes and ${
								this.client.user
							} will automatically change your discord nickname
						`,
							redisKey: `dm:${member.id}:nickname:ign`,
						});
						break;

					case NickChangeReason.NotUnique:
						void GuildMemberUtil.sendDM(member, {
							content: stripIndents`
								the name \`${PREV_NAME}\` is already taken by another guild member.
								Your name should be unique to allow staff members to easily identify you
							`,
							redisKey: `dm:${member.id}:nickname:unique`,
						});
						break;

					default:
						logger.error(`[SYNC IGN DISPLAYNAME]: unknown reason: ${reason}`);
				}

				logger.info(this.logInfo, '[SYNC IGN DISPLAYNAME]: sent nickname info DM');
			}

			return true;
		} catch (error) {
			logger.error({ err: error, ...this.logInfo }, '[SYNC IGN DISPLAYNAME]');
			void this.setDiscordMember(null, error instanceof DiscordAPIError);
			return false;
		}
	}

	/**
	 * fetches the discord tag from hypixel
	 */
	public async fetchDiscordTag() {
		try {
			return (await hypixel.player.uuid(this.minecraftUuid)).player?.socialMedia?.links?.DISCORD ?? null;
		} catch (error) {
			logger.error({ err: error, ...this.logInfo }, '[FETCH DISCORD TAG]');
			return null;
		}
	}

	/**
	 * determines the player's main profile (profile with the most weight)
	 */
	public async fetchMainProfile() {
		let profiles = null;

		try {
			profiles = await getSkyBlockProfiles(this.minecraftUuid);
		} catch (error) {
			logger.error({ err: error, ...this.logInfo }, '[FETCH MAIN PROFILE]');
		}

		const mainProfile = findSkyblockProfile(profiles, this.minecraftUuid, FindProfileStrategy.MaxWeight);

		if (!mainProfile) {
			void safePromiseAll([
				this.update({ mainProfileId: null, xpUpdatesDisabled: true }),
				this.resetXp({ offsetToReset: Offset.Current }),
			]);

			throw 'no SkyBlock profiles';
		}

		const { profile_id: PROFILE_ID, cute_name: PROFILE_NAME } = mainProfile;

		if (PROFILE_ID === this.mainProfileId) return null;

		const { mainProfileName, mainProfileId } = this;

		await this.update({
			mainProfileId: PROFILE_ID,
			mainProfileName: PROFILE_NAME ?? 'unknown profile name',
			xpUpdatesDisabled: false,
		});

		logger.info(
			{
				...this.logInfo,
				old: { mainProfileName, mainProfileId },
				new: { mainProfileId: PROFILE_ID, mainProfileName: PROFILE_NAME },
			},
			'[FETCH MAIN PROFILE]',
		);

		return {
			oldProfileName: mainProfileName,
			newProfileName: PROFILE_NAME,
		};
	}

	/**
	 * updates the player's IGN via the mojang API
	 */
	public async updateIgn() {
		try {
			const { ign: CURRENT_IGN } = await mojang.uuid(this.minecraftUuid, { force: true });

			if (CURRENT_IGN === this.ign) return null;

			const { ign: OLD_IGN } = this;

			try {
				await this.update({ ign: CURRENT_IGN });
			} catch (error) {
				this.ign = OLD_IGN;
				return logger.error({ err: error, ...this.logInfo }, '[UPDATE IGN]');
			}

			void this.syncIgnWithDisplayName(false);

			return {
				oldIgn: OLD_IGN,
				newIgn: CURRENT_IGN,
			};
		} catch (error) {
			if (error instanceof Error && error.name.startsWith('Sequelize')) {
				return logger.error({ err: error, ...this.logInfo }, '[UPDATE IGN]');
			}

			// prevent further auto updates
			void this.client.config.set('MOJANG_API_ERROR', true);

			if (isAbortError(error)) {
				return logger.error(this.logInfo, '[UPDATE IGN]: request timeout');
			}

			return logger.error({ err: error, ...this.logInfo }, '[UPDATE IGN]');
		}
	}

	/**
	 * transfers xp offsets
	 *
	 * @param options
	 */
	public async transferXp({ from = '', to = '', types = XP_AND_DATA_TYPES }: TransferXpOptions) {
		for (const type of types) {
			if (isXPType(type)) {
				this[`${type}Xp${to}`] = this[`${type}Xp${from}`];
			} else {
				this[`${type}${to}`] = this[`${type}${from}`];
			}
		}

		return this.save();
	}

	/**
	 * resets the xp gained to 0
	 *
	 * @param options
	 */
	public async resetXp({ offsetToReset = null, typesToReset = XP_AND_DATA_TYPES }: ResetXpOptions = {}): Promise<this> {
		switch (offsetToReset) {
			case null:
				// no offset type specifies -> resetting everything
				await Promise.all(XP_OFFSETS.map(async (offset) => this.resetXp({ offsetToReset: offset, typesToReset })));
				return this.resetXp({ offsetToReset: Offset.Day, typesToReset });

			case Offset.Day:
				// append current xp to the beginning of the xpHistory-Array and pop of the last value
				for (const type of typesToReset) {
					if (isXPType(type)) {
						const xpHistory = this[`${type}XpHistory`];
						xpHistory.shift();
						xpHistory.push(this[`${type}Xp`]);
						this.changed(`${type}XpHistory`, true); // neccessary so that sequelize knows an array has changed and the db needs to be updated
					} else {
						const xpHistory = this[`${type}History`];
						xpHistory.shift();
						xpHistory.push(this[type]);
						this.changed(`${type}History`, true); // neccessary so that sequelize knows an array has changed and the db needs to be updated
					}
				}

				break;

			case Offset.Current:
				for (const type of typesToReset) {
					if (isXPType(type)) {
						this[`${type}Xp`] = 0;
					} else {
						this[type] = {};
					}
				}

				break;

			default:
				for (const type of typesToReset) {
					if (isXPType(type)) {
						this[`${type}Xp${offsetToReset}`] = this[`${type}Xp`];
					} else {
						this[`${type}${offsetToReset}`] = this[type];
					}
				}

				break;
		}

		return this.save();
	}

	/**
	 * resets the guild tax paid
	 */
	public async resetTax() {
		if (!this.paid) return this;

		const result = await this.client.db.models.Transaction.findAll({
			limit: 1,
			where: {
				from: this.minecraftUuid,
				type: TransactionType.Tax,
			},
			order: [['createdAt', 'DESC']],
			attributes: ['to', 'amount'],
			raw: true,
		});

		if (!result.length) return this.update({ paid: false });

		const transaction = await this.sequelize.transaction();

		try {
			await this.client.taxCollectors.cache
				.get(result[0]!.to)
				?.addAmount(-result[0]!.amount, TransactionType.Tax, { transaction });
			await this.update({ paid: false }, { transaction });

			await transaction.commit();
		} catch (error) {
			await transaction.rollback();
			throw error;
		}

		return this;
	}

	/**
	 * set the player to paid
	 */
	public async setToPaid({
		amount = this.client.config.get('TAX_AMOUNT'),
		collectedBy = this.minecraftUuid,
		auctionId = null,
	}: SetToPaidOptions = {}) {
		if (this.paid) {
			await Promise.all(this.addTransfer({ amount, collectedBy, auctionId, type: TransactionType.Donation }));
			return this;
		}

		const OVERFLOW = Math.max(amount - this.client.config.get('TAX_AMOUNT'), 0); // >=
		const TAX_AMOUNT = amount - OVERFLOW;
		const promises = this.addTransfer({ amount: TAX_AMOUNT, collectedBy, auctionId, type: TransactionType.Tax });

		if (OVERFLOW) {
			promises.push(...this.addTransfer({ amount: OVERFLOW, collectedBy, auctionId, type: TransactionType.Donation }));
		}

		await Promise.all(promises);

		return this.update({ paid: true });
	}

	/**
	 * set the player to paid
	 */
	public addTransfer({
		amount,
		collectedBy,
		auctionId = null,
		notes = null,
		type = TransactionType.Tax,
	}: AddTransferOptions): [Promise<TaxCollector>, Promise<Transaction>] {
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
	public async uncacheMember() {
		// remove from user player cache
		if (this.discordId) {
			const user = this.client.users.cache.get(this.discordId);
			if (user) UserUtil.setPlayer(user, null);
		}

		// remove cached member
		return this.setDiscordMember(null, false);
	}

	/**
	 * removes the element from member, user, guild, client cache
	 */
	public async uncache() {
		await this.uncacheMember();

		this.client.hypixelGuilds.sweepPlayerCache(this.guildId); // sweep hypixel guild player cache
		this.client.players.cache.delete(this.minecraftUuid);

		return this;
	}

	/**
	 * destroys the db entry and removes it from cache
	 */
	public override async destroy(options?: InstanceDestroyOptions) {
		await this.uncache();
		return super.destroy(options);
	}

	/**
	 * updates the guild xp and syncs guild mutes
	 *
	 * @param data - from the hypixel guild API
	 * @param hypixelGuild
	 */
	public async syncWithGuildData(
		{ expHistory = {}, rank }: Components.Schemas.GuildMember,
		hypixelGuild = this.hypixelGuild!,
	) {
		// update guild xp
		const [currentDay] = Object.keys(expHistory);

		if (currentDay) {
			const xp = expHistory[currentDay]!;

			if (this.guildXpDay === currentDay) {
				// xp gained on the same day
				if (xp > this.guildXpDaily) {
					// player gained gxp since last update
					this.guildXp += xp - this.guildXpDaily; // add delta
					this.guildXpDaily = xp;
				}
			} else {
				// new day
				this.guildXpDay = currentDay;
				this.guildXpDaily = xp;
				this.guildXp += xp;
			}
		}

		// update guild rank
		this.guildRankPriority =
			hypixelGuild.ranks.find(({ name }) => name === rank)?.priority ??
			(/^guild ?master$/i.test(rank) ? hypixelGuild.ranks.length + 1 : 1);

		try {
			return await this.save();
		} catch (error) {
			logger.error({ err: error, ...this.logInfo, data: { expHistory, rank } }, '[SYNC WITH GUILD DATA]');
			return this;
		}
	}

	/**
	 * returns the true and progression level for the provided skill type
	 *
	 * @param type - the skill or dungeon type
	 * @param offset - optional offset value to use instead of the current xp value
	 * @param useIndividualCap - whether to use the individual max level cap if existing
	 */
	public getSkillLevel(type: DungeonTypes | SkillTypes, offset: XPOffsets = '', useIndividualCap = true) {
		return getSkillLevel(
			type,
			this[`${type}Xp${offset}`],
			type === 'farming' && useIndividualCap ? this.farmingLvlCap : null,
		);
	}

	/**
	 * returns the true and progression skill average
	 *
	 * @param offset - optional offset value to use instead of the current xp value
	 */
	public getSkillAverage(offset: XPOffsets = '') {
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
	 *
	 * @param type - the slayer type
	 */
	public getSlayerLevel(type: SlayerTypes) {
		return getSlayerLevel(this[`${type}Xp`]);
	}

	/**
	 * returns the total slayer xp
	 *
	 * @param offset - optional offset value to use instead of the current xp value
	 */
	public getSlayerTotal(offset: XPOffsets = '') {
		return SLAYERS.reduce((acc, slayer) => acc + this[`${slayer}Xp${offset}`], 0);
	}

	/**
	 * calculates the player's weight using Lily's formula
	 *
	 * @param offset - optional offset value to use instead of the current xp value
	 */
	public getLilyWeight(offset: XPOffsets = '') {
		const SKILL_XP_LILY = LILY_SKILL_NAMES.map((skill) => this[`${skill}Xp${offset}`]);
		const {
			total,
			skill: { overflow },
		} = getLilyWeightRaw(
			LILY_SKILL_NAMES.map((skill, index) => getSkillLevel(skill, SKILL_XP_LILY[index], 60).trueLevel), // skill levels
			SKILL_XP_LILY, // skill xp
			this[`catacombsCompletions${offset}`] as Parameters<typeof LilyWeight['getWeightRaw']>[2], // catacombs completions
			this[`catacombsMasterCompletions${offset}`] as Parameters<typeof LilyWeight['getWeightRaw']>[3], // master catacombs completions
			this[`catacombsXp${offset}`], // catacombs xp
			SLAYERS.map((slayer) => this[`${slayer}Xp${offset}`]), // slayer xp
		);

		return {
			weight: total - overflow,
			overflow,
			totalWeight: total,
		};
	}

	/**
	 * calculates the player's weight using Senither's formula
	 *
	 * @param offset - optional offset value to use instead of the current xp value
	 */
	public getSenitherWeight(offset: XPOffsets = '') {
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
	 *
	 * @param type - the skill or dungeon type
	 * @param index - xpHistory array index
	 */
	public getSkillLevelHistory(type: DungeonTypes | SkillTypes, index: number) {
		return getSkillLevel(type, this[`${type}XpHistory`][index], type === 'farming' ? this.farmingLvlCap : null);
	}

	/**
	 * returns the true and progression skill average
	 *
	 * @param index - xpHistory array index
	 */
	public getSkillAverageHistory(index: number) {
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
	 *
	 * @param index - xpHistory array index
	 */
	public getSlayerTotalHistory(index: number) {
		return SLAYERS.reduce((acc, slayer) => acc + (this[`${slayer}XpHistory`][index] ?? 0), 0);
	}

	/**
	 * calculates the player's weight using Lily's formula
	 *
	 * @param index - xpHistory array index
	 */
	public getLilyWeightHistory(index: number) {
		const SKILL_XP_LILY = LILY_SKILL_NAMES.map((skill) => this[`${skill}XpHistory`][index] ?? 0);
		const {
			total,
			skill: { overflow },
		} = getLilyWeightRaw(
			LILY_SKILL_NAMES.map((skill, index_) => getSkillLevel(skill, SKILL_XP_LILY[index_], 60).trueLevel), // skill levels
			SKILL_XP_LILY, // skill xp
			(this.catacombsCompletionsHistory[index] ?? {}) as Parameters<typeof LilyWeight['getWeightRaw']>[2], // catacombs completions
			(this.catacombsMasterCompletionsHistory[index] ?? {}) as Parameters<typeof LilyWeight['getWeightRaw']>[3], // master catacombs completions
			this.catacombsXpHistory[index] ?? 0, // catacombs xp
			SLAYERS.map((slayer) => this[`${slayer}XpHistory`][index] ?? 0), // slayer xp
		);

		return {
			weight: total - overflow,
			overflow,
			totalWeight: total,
		};
	}

	/**
	 * calculates the player's weight using Senither's formula
	 *
	 * @param index - xpHistory array index
	 */
	public getSenitherWeightHistory(index: number) {
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
	public async addInfraction() {
		this._infractions ??= []; // create infractions array if non-existent
		this._infractions.push(Date.now()); // add current time
		this.changed('_infractions', true); // neccessary so that sequelize knows an array has changed and the db needs to be updated

		try {
			return await this.save();
		} catch (error) {
			logger.error(error);
			return this;
		}
	}

	/**
	 * player IGN
	 */
	public override toString() {
		return this.ign;
	}
}

export default Player;
