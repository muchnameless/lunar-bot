import type { ArrayElementType } from '@sapphire/utilities';
import type { Snowflake } from 'discord.js';
import {
	Model,
	DataTypes,
	type CreationOptional,
	type InferAttributes,
	type InferCreationAttributes,
	type InstanceDestroyOptions,
	type ModelAttributeColumnOptions,
	type ModelStatic,
	type NonAttribute,
	type Sequelize,
} from 'sequelize';
import {
	CATACOMBS_ROLES,
	DELIMITER_ROLES,
	SKILLS,
	SKILL_AVERAGE_ROLES,
	SKILL_ROLES,
	SLAYERS,
	SLAYER_ROLES,
	SLAYER_TOTAL_ROLES,
} from '#constants';
import type { LunarClient } from '#structures/LunarClient.js';
import { toUpperCase } from '#types';

interface WeightRole {
	roleId: Snowflake;
	weightReq: number;
}

export class DiscordGuild extends Model<InferAttributes<DiscordGuild>, InferCreationAttributes<DiscordGuild>> {
	public declare readonly client: NonAttribute<LunarClient>;

	public declare discordId: Snowflake;

	public declare hypixelGuildIds: CreationOptional<string[]>;

	// roles
	public declare weightRoleIds: WeightRole[] | null;

	public declare ALCHEMY_50_ROLE_ID: Snowflake | null;

	public declare ALCHEMY_55_ROLE_ID: Snowflake | null;

	public declare ALCHEMY_60_ROLE_ID: Snowflake | null;

	public declare AVERAGE_LVL_40_ROLE_ID: Snowflake | null;

	public declare AVERAGE_LVL_45_ROLE_ID: Snowflake | null;

	public declare AVERAGE_LVL_50_ROLE_ID: Snowflake | null;

	public declare AVERAGE_LVL_55_ROLE_ID: Snowflake | null;

	public declare AVERAGE_LVL_60_ROLE_ID: Snowflake | null;

	public declare BLAZE_8_ROLE_ID: Snowflake | null;

	public declare BLAZE_9_ROLE_ID: Snowflake | null;

	public declare CATACOMBS_30_ROLE_ID: Snowflake | null;

	public declare CATACOMBS_35_ROLE_ID: Snowflake | null;

	public declare CATACOMBS_40_ROLE_ID: Snowflake | null;

	public declare CATACOMBS_45_ROLE_ID: Snowflake | null;

	public declare CATACOMBS_50_ROLE_ID: Snowflake | null;

	public declare COMBAT_50_ROLE_ID: Snowflake | null;

	public declare COMBAT_55_ROLE_ID: Snowflake | null;

	public declare COMBAT_60_ROLE_ID: Snowflake | null;

	public declare DUNGEON_DELIMITER_ROLE_ID: Snowflake | null;

	public declare ENCHANTING_50_ROLE_ID: Snowflake | null;

	public declare ENCHANTING_55_ROLE_ID: Snowflake | null;

	public declare ENCHANTING_60_ROLE_ID: Snowflake | null;

	public declare ENDERMAN_8_ROLE_ID: Snowflake | null;

	public declare ENDERMAN_9_ROLE_ID: Snowflake | null;

	public declare FARMING_50_ROLE_ID: Snowflake | null;

	public declare FARMING_55_ROLE_ID: Snowflake | null;

	public declare FARMING_60_ROLE_ID: Snowflake | null;

	public declare FISHING_50_ROLE_ID: Snowflake | null;

	public declare FISHING_55_ROLE_ID: Snowflake | null;

	public declare FISHING_60_ROLE_ID: Snowflake | null;

	public declare FORAGING_50_ROLE_ID: Snowflake | null;

	public declare FORAGING_55_ROLE_ID: Snowflake | null;

	public declare FORAGING_60_ROLE_ID: Snowflake | null;

	public declare GUILD_DELIMITER_ROLE_ID: Snowflake | null;

	/**
	 * Guardians
	 */
	public declare GUILD_ROLE_ID: Snowflake | null;

	public declare INACTIVE_ROLE_ID: Snowflake | null;

	public declare MINING_50_ROLE_ID: Snowflake | null;

	public declare MINING_55_ROLE_ID: Snowflake | null;

	public declare MINING_60_ROLE_ID: Snowflake | null;

	public declare MISC_DELIMITER_ROLE_ID: Snowflake | null;

	public declare SKILL_DELIMITER_ROLE_ID: Snowflake | null;

	public declare SLAYER_ALL_7_ROLE_ID: Snowflake | null;

	public declare SLAYER_ALL_8_ROLE_ID: Snowflake | null;

	public declare SLAYER_ALL_9_ROLE_ID: Snowflake | null;

	public declare SLAYER_DELIMITER_ROLE_ID: Snowflake | null;

	public declare SPIDER_8_ROLE_ID: Snowflake | null;

	public declare SPIDER_9_ROLE_ID: Snowflake | null;

	public declare TAMING_50_ROLE_ID: Snowflake | null;

	public declare TAMING_55_ROLE_ID: Snowflake | null;

	public declare TAMING_60_ROLE_ID: Snowflake | null;

	/**
	 * role a discord member must have for the bot to perform an action of them
	 */
	public declare MANDATORY_ROLE_ID: Snowflake | null;

	public declare WOLF_8_ROLE_ID: Snowflake | null;

	public declare WOLF_9_ROLE_ID: Snowflake | null;

	public declare ZOMBIE_8_ROLE_ID: Snowflake | null;

	public declare ZOMBIE_9_ROLE_ID: Snowflake | null;

	public static initialise(sequelize: Sequelize) {
		const attributes = {} as Record<
			| `${ArrayElementType<typeof DELIMITER_ROLES>}_DELIMITER_ROLE_ID`
			| `${Uppercase<ArrayElementType<typeof SKILLS>>}_${ArrayElementType<typeof SKILL_ROLES>}_ROLE_ID`
			| `${Uppercase<ArrayElementType<typeof SLAYERS>>}_${ArrayElementType<typeof SLAYER_ROLES>}_ROLE_ID`
			| `AVERAGE_LVL_${ArrayElementType<typeof SKILL_AVERAGE_ROLES>}_ROLE_ID`
			| `CATACOMBS_${ArrayElementType<typeof CATACOMBS_ROLES>}_ROLE_ID`
			| `SLAYER_ALL_${ArrayElementType<typeof SLAYER_TOTAL_ROLES>}_ROLE_ID`,
			ModelAttributeColumnOptions<DiscordGuild>
		>;

		// roles
		for (const type of DELIMITER_ROLES) {
			attributes[`${type}_DELIMITER_ROLE_ID`] = {
				type: DataTypes.TEXT,
				defaultValue: null,
				allowNull: true,
			};
		}

		for (const level of SKILL_AVERAGE_ROLES) {
			attributes[`AVERAGE_LVL_${level}_ROLE_ID`] = {
				type: DataTypes.TEXT,
				defaultValue: null,
				allowNull: true,
			};
		}

		for (const skill of SKILLS) {
			for (const level of SKILL_ROLES) {
				attributes[`${toUpperCase(skill)}_${level}_ROLE_ID`] = {
					type: DataTypes.TEXT,
					defaultValue: null,
					allowNull: true,
				};
			}
		}

		for (const level of SLAYER_TOTAL_ROLES) {
			attributes[`SLAYER_ALL_${level}_ROLE_ID`] = {
				type: DataTypes.TEXT,
				defaultValue: null,
				allowNull: true,
			};
		}

		for (const slayer of SLAYERS) {
			for (const level of SLAYER_ROLES) {
				attributes[`${toUpperCase(slayer)}_${level}_ROLE_ID`] = {
					type: DataTypes.TEXT,
					defaultValue: null,
					allowNull: true,
				};
			}
		}

		for (const level of CATACOMBS_ROLES) {
			attributes[`CATACOMBS_${level}_ROLE_ID`] = {
				type: DataTypes.TEXT,
				defaultValue: null,
				allowNull: true,
			};
		}

		return this.init(
			{
				discordId: {
					type: DataTypes.TEXT,
					primaryKey: true,
				},
				hypixelGuildIds: {
					type: DataTypes.ARRAY(DataTypes.TEXT),
					defaultValue: [],
					allowNull: false,
				},
				weightRoleIds: {
					type: DataTypes.ARRAY(DataTypes.JSONB),
					defaultValue: null,
					allowNull: true,
				},
				GUILD_ROLE_ID: {
					type: DataTypes.TEXT,
					defaultValue: null,
					allowNull: true,
				},
				INACTIVE_ROLE_ID: {
					type: DataTypes.TEXT,
					defaultValue: null,
					allowNull: true,
				},
				MANDATORY_ROLE_ID: {
					type: DataTypes.TEXT,
					defaultValue: null,
					allowNull: true,
				},
				...attributes,
			},
			{
				sequelize,
				timestamps: false,
			},
		) as ModelStatic<DiscordGuild>;
	}

	/**
	 * destroys the db entry and removes it from cache
	 */
	public override async destroy(options?: InstanceDestroyOptions) {
		this.client.discordGuilds.cache.delete(this.discordId);
		return super.destroy(options);
	}
}

export default DiscordGuild;
