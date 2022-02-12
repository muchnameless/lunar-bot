import { Model, DataTypes } from 'sequelize';
import {
	CATACOMBS_ROLES,
	DELIMITER_ROLES,
	SKILLS,
	SKILL_AVERAGE_ROLES,
	SKILL_ROLES,
	SLAYERS,
	SLAYER_ROLES,
	SLAYER_TOTAL_ROLES,
} from '../../../constants';
import type {
	CreationOptional,
	InferAttributes,
	InferCreationAttributes,
	InstanceDestroyOptions,
	ModelAttributeColumnOptions,
	ModelStatic,
	NonAttribute,
	Sequelize,
} from 'sequelize';
import type { Snowflake } from 'discord.js';
import type { LunarClient } from '../../LunarClient';
import type { ArrayElement } from '../../../types/util';

interface WeightRole {
	weightReq: number;
	roleId: Snowflake;
}

export class DiscordGuild extends Model<InferAttributes<DiscordGuild>, InferCreationAttributes<DiscordGuild>> {
	declare client: NonAttribute<LunarClient>;

	declare discordId: Snowflake;
	declare hypixelGuildIds: CreationOptional<string[]>;

	// roles
	declare weightRoleIds: CreationOptional<WeightRole[] | null>;

	declare ALCHEMY_50_ROLE_ID: CreationOptional<Snowflake | null>;
	declare ALCHEMY_55_ROLE_ID: CreationOptional<Snowflake | null>;
	declare ALCHEMY_60_ROLE_ID: CreationOptional<Snowflake | null>;
	declare AVERAGE_LVL_40_ROLE_ID: CreationOptional<Snowflake | null>;
	declare AVERAGE_LVL_45_ROLE_ID: CreationOptional<Snowflake | null>;
	declare AVERAGE_LVL_50_ROLE_ID: CreationOptional<Snowflake | null>;
	declare AVERAGE_LVL_55_ROLE_ID: CreationOptional<Snowflake | null>;
	declare AVERAGE_LVL_60_ROLE_ID: CreationOptional<Snowflake | null>;
	declare CATACOMBS_30_ROLE_ID: CreationOptional<Snowflake | null>;
	declare CATACOMBS_35_ROLE_ID: CreationOptional<Snowflake | null>;
	declare CATACOMBS_40_ROLE_ID: CreationOptional<Snowflake | null>;
	declare CATACOMBS_45_ROLE_ID: CreationOptional<Snowflake | null>;
	declare CATACOMBS_50_ROLE_ID: CreationOptional<Snowflake | null>;
	declare COMBAT_50_ROLE_ID: CreationOptional<Snowflake | null>;
	declare COMBAT_55_ROLE_ID: CreationOptional<Snowflake | null>;
	declare COMBAT_60_ROLE_ID: CreationOptional<Snowflake | null>;
	declare DUNGEON_DELIMITER_ROLE_ID: CreationOptional<Snowflake | null>;
	declare ENCHANTING_50_ROLE_ID: CreationOptional<Snowflake | null>;
	declare ENCHANTING_55_ROLE_ID: CreationOptional<Snowflake | null>;
	declare ENCHANTING_60_ROLE_ID: CreationOptional<Snowflake | null>;
	declare ENDERMAN_8_ROLE_ID: CreationOptional<Snowflake | null>;
	declare ENDERMAN_9_ROLE_ID: CreationOptional<Snowflake | null>;
	declare FARMING_50_ROLE_ID: CreationOptional<Snowflake | null>;
	declare FARMING_55_ROLE_ID: CreationOptional<Snowflake | null>;
	declare FARMING_60_ROLE_ID: CreationOptional<Snowflake | null>;
	declare FISHING_50_ROLE_ID: CreationOptional<Snowflake | null>;
	declare FISHING_55_ROLE_ID: CreationOptional<Snowflake | null>;
	declare FISHING_60_ROLE_ID: CreationOptional<Snowflake | null>;
	declare FORAGING_50_ROLE_ID: CreationOptional<Snowflake | null>;
	declare FORAGING_55_ROLE_ID: CreationOptional<Snowflake | null>;
	declare FORAGING_60_ROLE_ID: CreationOptional<Snowflake | null>;
	declare GUILD_DELIMITER_ROLE_ID: CreationOptional<Snowflake | null>;
	/** Guardians */
	declare GUILD_ROLE_ID: CreationOptional<Snowflake | null>;
	declare INACTIVE_ROLE_ID: CreationOptional<Snowflake | null>;
	declare MINING_50_ROLE_ID: CreationOptional<Snowflake | null>;
	declare MINING_55_ROLE_ID: CreationOptional<Snowflake | null>;
	declare MINING_60_ROLE_ID: CreationOptional<Snowflake | null>;
	declare MISC_DELIMITER_ROLE_ID: CreationOptional<Snowflake | null>;
	declare SKILL_DELIMITER_ROLE_ID: CreationOptional<Snowflake | null>;
	declare SLAYER_ALL_7_ROLE_ID: CreationOptional<Snowflake | null>;
	declare SLAYER_ALL_8_ROLE_ID: CreationOptional<Snowflake | null>;
	declare SLAYER_ALL_9_ROLE_ID: CreationOptional<Snowflake | null>;
	declare SLAYER_DELIMITER_ROLE_ID: CreationOptional<Snowflake | null>;
	declare SPIDER_8_ROLE_ID: CreationOptional<Snowflake | null>;
	declare SPIDER_9_ROLE_ID: CreationOptional<Snowflake | null>;
	declare TAMING_50_ROLE_ID: CreationOptional<Snowflake | null>;
	declare TAMING_55_ROLE_ID: CreationOptional<Snowflake | null>;
	declare TAMING_60_ROLE_ID: CreationOptional<Snowflake | null>;
	/** role a discord member must have for the bot to perform an action of them */
	declare MANDATORY_ROLE_ID: CreationOptional<Snowflake | null>;
	declare WOLF_8_ROLE_ID: CreationOptional<Snowflake | null>;
	declare WOLF_9_ROLE_ID: CreationOptional<Snowflake | null>;
	declare ZOMBIE_8_ROLE_ID: CreationOptional<Snowflake | null>;
	declare ZOMBIE_9_ROLE_ID: CreationOptional<Snowflake | null>;

	static initialise(sequelize: Sequelize) {
		const attributes = {} as Record<
			| `${ArrayElement<typeof DELIMITER_ROLES>}_DELIMITER_ROLE_ID`
			| `AVERAGE_LVL_${ArrayElement<typeof SKILL_AVERAGE_ROLES>}_ROLE_ID`
			| `${Uppercase<ArrayElement<typeof SKILLS>>}_${ArrayElement<typeof SKILL_ROLES>}_ROLE_ID`
			| `SLAYER_ALL_${ArrayElement<typeof SLAYER_TOTAL_ROLES>}_ROLE_ID`
			| `${Uppercase<ArrayElement<typeof SLAYERS>>}_${ArrayElement<typeof SLAYER_ROLES>}_ROLE_ID`
			| `CATACOMBS_${ArrayElement<typeof CATACOMBS_ROLES>}_ROLE_ID`,
			ModelAttributeColumnOptions<DiscordGuild>
		>;

		// roles
		for (const type of DELIMITER_ROLES) {
			attributes[`${type}_DELIMITER_ROLE_ID`] = {
				type: DataTypes.STRING,
				defaultValue: null,
				allowNull: true,
			};
		}

		for (const level of SKILL_AVERAGE_ROLES) {
			attributes[`AVERAGE_LVL_${level}_ROLE_ID`] = {
				type: DataTypes.STRING,
				defaultValue: null,
				allowNull: true,
			};
		}

		for (const skill of SKILLS) {
			for (const level of SKILL_ROLES) {
				attributes[`${skill.toUpperCase() as Uppercase<typeof skill>}_${level}_ROLE_ID`] = {
					type: DataTypes.STRING,
					defaultValue: null,
					allowNull: true,
				};
			}
		}

		for (const level of SLAYER_TOTAL_ROLES) {
			attributes[`SLAYER_ALL_${level}_ROLE_ID`] = {
				type: DataTypes.STRING,
				defaultValue: null,
				allowNull: true,
			};
		}

		for (const slayer of SLAYERS) {
			for (const level of SLAYER_ROLES) {
				attributes[`${slayer.toUpperCase() as Uppercase<typeof slayer>}_${level}_ROLE_ID`] = {
					type: DataTypes.STRING,
					defaultValue: null,
					allowNull: true,
				};
			}
		}

		for (const level of CATACOMBS_ROLES) {
			attributes[`CATACOMBS_${level}_ROLE_ID`] = {
				type: DataTypes.STRING,
				defaultValue: null,
				allowNull: true,
			};
		}

		return this.init(
			{
				discordId: {
					type: DataTypes.STRING,
					primaryKey: true,
				},
				hypixelGuildIds: {
					type: DataTypes.ARRAY(DataTypes.STRING),
					defaultValue: [],
					allowNull: false,
				},
				weightRoleIds: {
					type: DataTypes.ARRAY(DataTypes.JSONB),
					defaultValue: null,
					allowNull: true,
				},
				GUILD_ROLE_ID: {
					type: DataTypes.STRING,
					defaultValue: null,
					allowNull: true,
				},
				INACTIVE_ROLE_ID: {
					type: DataTypes.STRING,
					defaultValue: null,
					allowNull: true,
				},
				MANDATORY_ROLE_ID: {
					type: DataTypes.STRING,
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
	override destroy(options?: InstanceDestroyOptions) {
		this.client.discordGuilds.cache.delete(this.discordId);
		return super.destroy(options);
	}
}

export default DiscordGuild;
