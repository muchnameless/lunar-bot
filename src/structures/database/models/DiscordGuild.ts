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
import type { ModelStatic, Sequelize, Optional } from 'sequelize';
import type { Snowflake } from 'discord.js';
import type { LunarClient } from '../../LunarClient';

interface WeightRole {
	weightReq: number;
	roleId: Snowflake;
}

interface DiscordGuildAttributes {
	discordId: Snowflake;
	hypixelGuildIds: string[];
	weightRoleIds: WeightRole[] | null;
	GUILD_ROLE_ID: Snowflake | null;
}

type DiscordGuildCreationAttributes = Optional<
	DiscordGuildAttributes,
	'hypixelGuildIds' | 'weightRoleIds' | 'GUILD_ROLE_ID'
>;

export class DiscordGuild
	extends Model<DiscordGuildAttributes, DiscordGuildCreationAttributes>
	implements DiscordGuildAttributes
{
	declare client: LunarClient;

	declare discordId: Snowflake;
	declare hypixelGuildIds: string[];

	// roles
	declare weightRoleIds: WeightRole[] | null;

	declare ALCHEMY_50_ROLE_ID: Snowflake | null;
	declare ALCHEMY_55_ROLE_ID: Snowflake | null;
	declare ALCHEMY_60_ROLE_ID: Snowflake | null;
	declare AVERAGE_LVL_40_ROLE_ID: Snowflake | null;
	declare AVERAGE_LVL_45_ROLE_ID: Snowflake | null;
	declare AVERAGE_LVL_50_ROLE_ID: Snowflake | null;
	declare AVERAGE_LVL_55_ROLE_ID: Snowflake | null;
	declare AVERAGE_LVL_60_ROLE_ID: Snowflake | null;
	declare CATACOMBS_30_ROLE_ID: Snowflake | null;
	declare CATACOMBS_35_ROLE_ID: Snowflake | null;
	declare CATACOMBS_40_ROLE_ID: Snowflake | null;
	declare CATACOMBS_45_ROLE_ID: Snowflake | null;
	declare CATACOMBS_50_ROLE_ID: Snowflake | null;
	declare COMBAT_50_ROLE_ID: Snowflake | null;
	declare COMBAT_55_ROLE_ID: Snowflake | null;
	declare COMBAT_60_ROLE_ID: Snowflake | null;
	declare DUNGEON_DELIMITER_ROLE_ID: Snowflake | null;
	declare ENCHANTING_50_ROLE_ID: Snowflake | null;
	declare ENCHANTING_55_ROLE_ID: Snowflake | null;
	declare ENCHANTING_60_ROLE_ID: Snowflake | null;
	declare ENDERMAN_8_ROLE_ID: Snowflake | null;
	declare ENDERMAN_9_ROLE_ID: Snowflake | null;
	declare FARMING_50_ROLE_ID: Snowflake | null;
	declare FARMING_55_ROLE_ID: Snowflake | null;
	declare FARMING_60_ROLE_ID: Snowflake | null;
	declare FISHING_50_ROLE_ID: Snowflake | null;
	declare FISHING_55_ROLE_ID: Snowflake | null;
	declare FISHING_60_ROLE_ID: Snowflake | null;
	declare FORAGING_50_ROLE_ID: Snowflake | null;
	declare FORAGING_55_ROLE_ID: Snowflake | null;
	declare FORAGING_60_ROLE_ID: Snowflake | null;
	declare GUILD_DELIMITER_ROLE_ID: Snowflake | null;
	/** Guardians */
	declare GUILD_ROLE_ID: Snowflake | null;
	declare INACTIVE_ROLE_ID: Snowflake | null;
	declare MINING_50_ROLE_ID: Snowflake | null;
	declare MINING_55_ROLE_ID: Snowflake | null;
	declare MINING_60_ROLE_ID: Snowflake | null;
	declare MISC_DELIMITER_ROLE_ID: Snowflake | null;
	declare SKILL_DELIMITER_ROLE_ID: Snowflake | null;
	declare SLAYER_ALL_7_ROLE_ID: Snowflake | null;
	declare SLAYER_ALL_8_ROLE_ID: Snowflake | null;
	declare SLAYER_ALL_9_ROLE_ID: Snowflake | null;
	declare SLAYER_DELIMITER_ROLE_ID: Snowflake | null;
	declare SPIDER_8_ROLE_ID: Snowflake | null;
	declare SPIDER_9_ROLE_ID: Snowflake | null;
	declare TAMING_50_ROLE_ID: Snowflake | null;
	declare TAMING_55_ROLE_ID: Snowflake | null;
	declare TAMING_60_ROLE_ID: Snowflake | null;
	/** role a discord member must have for the bot to perform an action of them */
	declare MANDATORY_ROLE_ID: Snowflake | null;
	declare WOLF_8_ROLE_ID: Snowflake | null;
	declare WOLF_9_ROLE_ID: Snowflake | null;
	declare ZOMBIE_8_ROLE_ID: Snowflake | null;
	declare ZOMBIE_9_ROLE_ID: Snowflake | null;

	static initialise(sequelize: Sequelize) {
		const attributes = {};

		// roles
		for (const type of DELIMITER_ROLES) {
			Reflect.set(attributes, `${type}_DELIMITER_ROLE_ID`, {
				type: DataTypes.STRING,
				defaultValue: null,
				allowNull: true,
			});
		}

		for (const level of SKILL_AVERAGE_ROLES) {
			Reflect.set(attributes, `AVERAGE_LVL_${level}_ROLE_ID`, {
				type: DataTypes.STRING,
				defaultValue: null,
				allowNull: true,
			});
		}

		for (const skill of SKILLS) {
			for (const level of SKILL_ROLES) {
				Reflect.set(attributes, `${skill.toUpperCase()}_${level}_ROLE_ID`, {
					type: DataTypes.STRING,
					defaultValue: null,
					allowNull: true,
				});
			}
		}

		for (const level of SLAYER_TOTAL_ROLES) {
			Reflect.set(attributes, `SLAYER_ALL_${level}_ROLE_ID`, {
				type: DataTypes.STRING,
				defaultValue: null,
				allowNull: true,
			});
		}

		for (const slayer of SLAYERS) {
			for (const level of SLAYER_ROLES) {
				Reflect.set(attributes, `${slayer.toUpperCase()}_${level}_ROLE_ID`, {
					type: DataTypes.STRING,
					defaultValue: null,
					allowNull: true,
				});
			}
		}

		for (const level of CATACOMBS_ROLES) {
			Reflect.set(attributes, `CATACOMBS_${level}_ROLE_ID`, {
				type: DataTypes.STRING,
				defaultValue: null,
				allowNull: true,
			});
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
				...attributes,
			},
			{
				sequelize,
				timestamps: false,
			},
		) as ModelStatic<DiscordGuild>;
	}
}

export default DiscordGuild;
