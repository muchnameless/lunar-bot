import pkg from 'sequelize';
const { Model, DataTypes } = pkg;
import { DUNGEON_FLOOR_MAX, DUNGEON_TYPES, SKILLS, SKYBLOCK_XP_TYPES } from '../../../constants';
import type { ModelStatic, Sequelize } from 'sequelize';
import type { LunarClient } from '../../LunarClient';
import type { db } from '..';
import type { Components } from '@zikeji/hypixel';


export const enum SkyblockDataOffset {
	CURRENT = 'current',

	DAY = 'day',
	MAYOR = 'mayor',
	WEEK = 'week',
	MONTH = 'month',

	COMPETITION_END = 'competitionEnd',
	COMPETITION_START = 'competitionStart',
}

interface SkyBlockDataAttributes {
	minecraftUuid: string;
	mainProfileId: string;
	mainProfileName: string;

	taming: number;
	farming: number;
	mining: number;
	combat: number;
	foraging: number;
	fishing: number;
	enchanting: number;
	alchemy: number;

	carpentry: number;
	runecrafting: number;

	skillAPIEnabled: boolean;
	farmingLevelCap: number;

	zombie: number;
	spider: number;
	wolf: number;
	enderman: number;

	catacombs: number;

	healer: number;
	mage: number;
	berserk: number;
	archer: number;
	tank: number;

	catacombsFloor1: number;
	catacombsFloor2: number;
	catacombsFloor3: number;
	catacombsFloor4: number;
	catacombsFloor5: number;
	catacombsFloor6: number;
	catacombsFloor7: number;
	catacombsFloor8: number;
	catacombsFloor9: number;
	catacombsFloor10: number;

	catacombsMasterFloor1: number;
	catacombsMasterFloor2: number;
	catacombsMasterFloor3: number;
	catacombsMasterFloor4: number;
	catacombsMasterFloor5: number;
	catacombsMasterFloor6: number;
	catacombsMasterFloor7: number;
	catacombsMasterFloor8: number;
	catacombsMasterFloor9: number;
	catacombsMasterFloor10: number;

	type: SkyblockDataOffset;
}


export class SkyBlockData extends Model<SkyBlockDataAttributes> implements SkyBlockDataAttributes {
	declare client: LunarClient;

	declare minecraftUuid: string;
	declare mainProfileId: string;
	declare mainProfileName: string;

	declare taming: number;
	declare farming: number;
	declare mining: number;
	declare combat: number;
	declare foraging: number;
	declare fishing: number;

	declare enchanting: number;
	declare alchemy: number;

	declare carpentry: number;
	declare runecrafting: number;

	declare skillAPIEnabled: boolean;
	declare farmingLevelCap: number;

	declare zombie: number;
	declare spider: number;
	declare wolf: number;
	declare enderman: number;

	declare catacombs: number;

	declare healer: number;
	declare mage: number;
	declare berserk: number;
	declare archer: number;
	declare tank: number;

	declare catacombsFloor1: number;
	declare catacombsFloor2: number;
	declare catacombsFloor3: number;
	declare catacombsFloor4: number;
	declare catacombsFloor5: number;
	declare catacombsFloor6: number;
	declare catacombsFloor7: number;
	declare catacombsFloor8: number;
	declare catacombsFloor9: number;
	declare catacombsFloor10: number;

	declare catacombsMasterFloor1: number;
	declare catacombsMasterFloor2: number;
	declare catacombsMasterFloor3: number;
	declare catacombsMasterFloor4: number;
	declare catacombsMasterFloor5: number;
	declare catacombsMasterFloor6: number;
	declare catacombsMasterFloor7: number;
	declare catacombsMasterFloor8: number;
	declare catacombsMasterFloor9: number;
	declare catacombsMasterFloor10: number;

	declare type: SkyblockDataOffset;

	declare readonly createdAt: Date;
	declare readonly updatedAt: Date;

	static initialise(sequelize: Sequelize) {
		const attributes = {
			mainProfileId: {
				type: DataTypes.STRING,
			},
			mainProfileName: {
				type: DataTypes.STRING,
			},
			skillAPIEnabled: {
				type: DataTypes.BOOLEAN,
			},
			farmingLvlCap: {
				type: DataTypes.INTEGER,
				defaultValue: 50,
				allowNull: false,
			},
			type: {
				type: DataTypes.ENUM(
					SkyblockDataOffset.CURRENT,
				),
				defaultValue: SkyblockDataOffset.CURRENT,
				allowNull: false,
			},
		};

		// xp types
		for (const type of SKYBLOCK_XP_TYPES) {
			Reflect.set(
				attributes,
				type,
				{
					type: DataTypes.DECIMAL,
					defaultValue: null,
					allowNull: true,
				},
			);
		}

		// dungeon completions
		for (const type of DUNGEON_TYPES) {
			for (let floor = 1; floor <= DUNGEON_FLOOR_MAX; ++floor) {
				Reflect.set(
					attributes,
					`${type}Floor${floor}`,
					{
						type: DataTypes.INTEGER,
						defaultValue: 0,
						allowNull: false,
					},
				);
				Reflect.set(
					attributes,
					`${type}MasterFloor${floor}`,
					{
						type: DataTypes.INTEGER,
						defaultValue: 0,
						allowNull: false,
					},
				);
			}
		}

		return this.init(
			// @ts-expect-error
			attributes,
			{
				sequelize,
				modelName: 'SkyBlockData',
			},
		) as ModelStatic<SkyBlockData>;
	}

	static associate({ Player }: typeof db) {
		this.belongsTo(Player, {
			foreignKey: 'minecraftUuid',
			targetKey: 'minecraftUuid',
			onDelete: 'NO ACTION',
		});
	}

	static fromAPIData(playerData: Components.Schemas.SkyBlockProfileMember) {
		this.create({
			
		})

		/**
		 * SKILLS
		 */
		if (Reflect.has(playerData, 'experience_skill_alchemy')) {
			for (const skill of SKILLS) this[skill] = playerData[`experience_skill_${skill}`] ?? 0;
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
	}
}

export default SkyBlockData;
