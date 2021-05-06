'use strict';

const { MessageEmbed, Permissions: { FLAGS: { MANAGE_ROLES } } } = require('discord.js');
const { Model, DataTypes } = require('sequelize');
const { stripIndents } = require('common-tags');
const { XP_TYPES, XP_OFFSETS, UNKNOWN_IGN, GUILD_ID_ERROR, GUILD_ID_BRIDGER, offsetFlags: { DAY, CURRENT } } = require('../../../constants/database');
const { skillsCap, dungeonXp, slayerXp, skills, cosmeticSkills, skillsAchievements, levelingXpTotal, slayers, dungeonTypes, dungeonClasses } = require('../../../constants/skyblock');
const { SKILL_EXPONENTS, SKILL_DIVIDER, SLAYER_DIVIDER, SLAYER_MODIFIER, DUNGEON_EXPONENTS } = require('../../../constants/weight');
const { delimiterRoles, skillAverageRoles, skillRoles, slayerTotalRoles, slayerRoles, catacombsRoles } = require('../../../constants/roles');
const { NICKNAME_MAX_CHARS } = require('../../../constants/discord');
const { escapeIgn, trim } = require('../../../functions/util');
const { getSkillLevel, getWeight } = require('../../../functions/skyblock');
const { validateNumber } = require('../../../functions/stringValidators');
const { mutedCheck } = require('../../../functions/database');
const NonAPIError = require('../../errors/NonAPIError');
const LunarGuildMember = require('../../extensions/GuildMember');
const hypixel = require('../../../api/hypixel');
const mojang = require('../../../api/mojang');
const logger = require('../../../functions/logger');


module.exports = class Player extends Model {
	constructor(...args) {
		super(...args);

		/**
		 * @type {?LunarGuildMember}
		 */
		this._discordMember = null;
		/**
		 * @type {import('../../LunarClient')}
		 */
		this.client;
		/**
		 * @type {string}
		 */
		this.minecraftUUID;
		/**
		 * @type {string}
		 */
		this.ign;
		/**
		 * @type {string}
		 */
		this.discordID;
		/**
		 * @type {string}
		 */
		this.guildID;
		/**
		 * @type {number}
		 */
		this.guildRankPriority;
		/**
		 * @type {boolean}
		 */
		this.inDiscord;
		/**
		 * @type {number}
		 */
		this.chatBridgeMutedUntil;
		/**
		 * @type {boolean}
		 */
		this.hasDiscordPingPermission;
		/**
		 * @type {boolean}
		 */
		this.paid;
		/**
		 * @type {?string}
		 */
		this.notes;
		/**
		 * @type {string}
		 */
		this.mainProfileID;
		/**
		 * cuteName (fruit name)
		 * @type {string}
		 */
		this.mainProfileName;
		/**
		 * @type {number}
		 */
		this.xpLastUpdatedAt;
		/**
		 * @type {number}
		 */
		this.farmingLvlCap;
		/**
		 * @type {string}
		 */
		this.guildXpDay;
		/**
		 * @type {number}
		 */
		this.guildXpDaily;

		// this.skills = Object.fromEntries(
		// 	skills.map(skill => [ skill, () => getSkillLevel(skill, this[`${skill}Xp`], this[`${skill}LvlCap`]) ]),
		// );

		// this.skills = {};

		// for (const skill of skills) {
		// 	Object.defineProperty(this.skills, skill, {
		// 		get() {
		// 			return getSkillLevel(skill, this[`${skill}Xp`], this[`${skill}LvlCap`]);
		// 		},
		// 	});
		// }

		Object.defineProperties(this, {
			discordMember: {
				/**
				 * @type {Promise<?LunarGuildMember>}
				 */
				async get() {
					if (this._discordMember) return this._discordMember;
					if (!this.inDiscord) return null;

					try {
						return this.discordMember = await this.client.lgGuild?.members.fetch(this.discordID ?? (() => { throw new TypeError('discordID must be a string'); })) ?? null;
					} catch (error) {
						this.inDiscord = false; // prevent further fetches and try to link via cache in the next updateDiscordMember calls
						this.save();
						logger.error(`[GET DISCORD MEMBER]: ${this.logInfo}: ${error}`);
						return this._discordMember = null;
					}
				},
				set(member) {
					if (member == null) {
						if (!this.inDiscord) return;

						this.inDiscord = false;
						this.save({ fields: [ 'inDiscord' ] });

						return;
					}

					if (!(member instanceof LunarGuildMember)) throw new TypeError(`[SET DISCORD MEMBER]: ${this.logInfo}: member must be a LunarGuildMember`);

					this._discordMember = member;

					if (this.inDiscord) return;

					this.inDiscord = true;
					this.save({ fields: [ 'inDiscord' ] });
				},
			},

			taxAmount: {
				/**
				 * @returns {Promise<number>}
				 */
				async get() {
					const result = await this.client.db.models.Transaction.findAll({
						limit: 1,
						where: {
							from: this.minecraftUUID,
							type: 'tax',
						},
						order: [ [ 'createdAt', 'DESC' ] ],
						attributes: [ 'amount' ],
						raw: true,
					});

					return result.length
						? result[0].amount
						: null;
				},

			},

			transactions: {
				/**
				 * @returns {Promise<ParsedTransaction[]>}
				 */
				async get() {
					return Promise.all(
						(await this.client.db.models.Transaction.findAll({
							where: {
								from: this.minecraftUUID,
							},
							order: [ [ 'createdAt', 'DESC' ] ],
							raw: true,
						}))
							.map(async transaction => ({
								...transaction,
								fromIGN: this.ign,
								toIGN: (this.client.players.cache.get(transaction.to) ?? await mojang.uuid(transaction.to).catch(logger.error))?.ign,
							})),
					);
				},
			},
		});
	}

	/**
	 * @param {import('sequelize')} sequelize
	 */
	static init(sequelize) {
		const dataObject = {
			// general information
			minecraftUUID: {
				type: DataTypes.STRING,
				primaryKey: true,
			},
			ign: {
				type: DataTypes.STRING,
				defaultValue: null,
				allowNull: true,
			},
			discordID: {
				type: DataTypes.STRING,
				defaultValue: null,
				allowNull: true,
				set(value) {
					if (!value) this.inDiscord = false;
					this.setDataValue('discordID', value);
				},
			},
			guildID: {
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
				set(value) {
					if (!value) this._discordMember = null;
					this.setDataValue('inDiscord', value);
				},
			},
			chatBridgeMutedUntil: {
				type: DataTypes.BIGINT,
				defaultValue: 0,
				allowNull: false,
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
			mainProfileID: {
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
		};

		// add xp types
		XP_TYPES.forEach((type) => {
			dataObject[`${type}Xp`] = {
				type: DataTypes.DECIMAL,
				defaultValue: 0,
				allowNull: false,
			};

			dataObject[`${type}XpHistory`] = {
				type: DataTypes.ARRAY(DataTypes.DECIMAL),
				defaultValue: new Array(30).fill(0),
				allowNull: false,
			};

			XP_OFFSETS.forEach((offset) => {
				dataObject[`${type}Xp${offset}`] = {
					type: DataTypes.DECIMAL,
					defaultValue: 0,
					allowNull: false,
				};
			});
		});

		return super.init(dataObject, {
			sequelize,
			modelName: 'Player',
			indexes: [{ // setting unique down here works with `sync --alter`
				unique: true,
				fields: [ 'discordID' ],
			}],
		});
	}

	// get weight() {
	// 	return {
	// 		weekly: get ,
	// 		monthly
	// 		mayor
	// 	}
	// }

	/**
	 * returns the hypixel guild db object associated with the player
	 * @returns {?import('./HypixelGuild')}
	 */
	get guild() {
		return this.client.hypixelGuilds.cache.get(this.guildID) ?? logger.warn(`[GET GUILD]: ${this.ign}: no guild with the id '${this.guildID}' found`);
	}

	/**
	 * wether the player is a bridger or error case
	 */
	get notInGuild() {
		return [ null, GUILD_ID_BRIDGER, GUILD_ID_ERROR ].includes(this.guildID);
	}

	// the following is just for JSDOC's sake

	/**
	 * fetches the discord member if the discord id is valid and the player is in lg discord
	 * @type {Promise<?LunarGuildMember>}
	 */
	get discordMember() {} // eslint-disable-line getter-return, no-empty-function, class-methods-use-this

	/**
	 * fetches the discord user if the discord id is valid
	 * @returns {Promise<?import('../../extensions/User')>}
	 */
	get discordUser() {
		return validateNumber(this.discordID)
			? this.client.users.fetch(this.discordID)
			: null;
	}

	/**
	 * returns the guild rank of the player
	 * @returns {?import('./HypixelGuild').GuildRank}
	 */
	get guildRank() {
		return this.guild?.ranks?.find(({ priority }) => priority === this.guildRankPriority) ?? null;
	}

	/**
	 * returns the player's guild name
	 */
	get guildName() {
		switch (this.guildID) {
			case GUILD_ID_BRIDGER:
				return 'Bridger';

			case GUILD_ID_ERROR:
				return 'Error';

			default:
				return this.guild?.name ?? 'unknown guild';
		}
	}

	/**
	 * returns a string with the ign and guild name
	 */
	get info() {
		return `${escapeIgn(this.ign)} | ${this.guildName}`; // •
	}

	/**
	 * returns a string with the ign and guild name
	 */
	get logInfo() {
		return `${this.ign} (${this.guildName})`;
	}

	/**
	 * returs a rendered bust image of the player's skin
	 */
	get image() {
		return `https://visage.surgeplay.com/bust/${this.minecraftUUID}`;
	}

	/**
	 * returns a sky.shiiyu.moe link for the player
	 */
	get url() {
		return `https://sky.shiiyu.moe/stats/${this.ign}/${this.mainProfileName}`;
	}

	/**
	 * wether the player has an ingame staff rank,
	 * assumes the last two guild ranks are staff ranks
	 */
	get isStaff() {
		return this.guildRankPriority && this.guildRankPriority >= this.guild?.ranks.length - 1;
	}

	/**
	 * amount of the last tax transaction from that player
	 * @returns {Promise<?number>}
	 */
	get taxAmount() {} // eslint-disable-line getter-return, no-empty-function, class-methods-use-this

	/**
	 * @typedef {import('./Transaction').Transaction} ParsedTransaction
	 * @property {string} fromIGN
	 * @property {?string} toIGN
	 */

	/**
	 * all transactions from that player
	 * @returns {Promise<ParsedTransaction[]>}
	 */
	get transactions() {} // eslint-disable-line getter-return, no-empty-function, class-methods-use-this

	/**
	 * wether the player is muted and that mute is not expired
	 */
	get muted() {
		return mutedCheck(this);
	}

	/**
	 * @typedef {object} PlayerUpdateOptions
	 * @property {?string} [reason] role update reason for discord's audit logs
	 * @property {boolean} [shouldSendDm=false] wether to dm the user that they should include their ign somewhere in their nickname
	 * @property {boolean} [shouldOnlyAwaitUpdateXp=false] wether to only await the updateXp call and not updateDiscordMember
	 * @property {boolean} [rejectOnAPIError=false]
	 */

	/**
	 * updates the player data and discord member
	 * @param {PlayerUpdateOptions} options
	 */
	async update({ reason = 'synced with ingame stats', shouldSendDm = false, shouldOnlyAwaitUpdateXp = false, rejectOnAPIError = false } = {}) {
		if (this.guildID === GUILD_ID_BRIDGER) return;
		if (this.guildID !== GUILD_ID_ERROR) await this.updateXp(rejectOnAPIError); // only query hypixel skyblock api for guild players without errors

		if (shouldOnlyAwaitUpdateXp) {
			this.updateDiscordMember({ reason, shouldSendDm });
		} else {
			await this.updateDiscordMember({ reason, shouldSendDm });
		}
	}

	/**
	 * updates skill and slayer xp
	 * @param {boolean} [rejectOnAPIError=false]
	 */
	async updateXp(rejectOnAPIError = false) {
		try {
			if (!this.mainProfileID) await this.fetchMainProfile(); // detect main profile if it is unknown

			// hypixel API call
			const { meta: { cached }, members } = await hypixel.skyblock.profile(this.mainProfileID);

			if (cached && Date.now() - this.xpLastUpdatedAt < (this.client.config.getNumber('DATABASE_UPDATE_INTERVAL') - 1) * 60_000) throw new NonAPIError('cached data');

			const playerData = members?.[this.minecraftUUID];

			if (!playerData) {
				this.mainProfileID = null;
				this.save();
				throw new NonAPIError(`unable to find main profile named '${this.mainProfileName}' -> resetting name`);
			}

			this.xpLastUpdatedAt = Date.now();

			// update xp
			if (Object.prototype.hasOwnProperty.call(playerData, 'experience_skill_alchemy')) {
				skills.forEach(skill => this[`${skill}Xp`] = playerData[`experience_skill_${skill}`] ?? 0);
				cosmeticSkills.forEach(skill => this[`${skill}Xp`] = playerData[`experience_skill_${skill}`] ?? 0);

				// reset skill xp if no taming xp offset
				if (this.tamingXp !== 0) {
					for (const offset of XP_OFFSETS) {
						if (this[`tamingXp${offset}`] === 0) {
							logger.info(`[UPDATE XP]: ${this.logInfo}: resetting '${offset}' skill xp`);
							await this.resetXp({ offsetToReset: offset, typesToReset: [ ...skills, ...cosmeticSkills ] });
						}
					}
				}
			} else {
				// log once every hour (during the first update)
				if (!(new Date().getHours() % 6) && new Date().getMinutes() < this.client.config.getNumber('DATABASE_UPDATE_INTERVAL')) logger.warn(`[UPDATE XP]: ${this.logInfo}: skill API disabled`);
				this.notes = 'skill api disabled';

				/**
				 * request achievements api
				 */
				const { achievements } = await hypixel.player.uuid(this.minecraftUUID);

				for (const skill of skills) {
					this[`${skill}Xp`] = levelingXpTotal[achievements[skillsAchievements[skill]]] ?? 0;
				}
			}

			this.farmingLvlCap = 50 + (playerData.jacob2?.perks?.farming_level_cap ?? 0);

			/**
			 * slayer
			 */

			slayers.forEach(slayer => this[`${slayer}Xp`] = playerData.slayer_bosses[slayer].xp ?? 0);

			// reset slayer xp if no zombie xp offset
			if (this.zombieXp !== 0) {
				for (const offset of XP_OFFSETS) {
					if (this[`zombieXp${offset}`] === 0) {
						logger.info(`[UPDATE XP]: ${this.logInfo}: resetting '${offset}' slayer xp`);
						await this.resetXp({ offsetToReset: offset, typesToReset: slayers });
					}
				}
			}

			// no slayer data found logging
			if (!Object.prototype.hasOwnProperty.call(playerData.slayer_bosses?.zombie ?? {}, 'xp') && !(new Date().getHours() % 6) && new Date().getMinutes() < this.client.config.getNumber('DATABASE_UPDATE_INTERVAL')) {
				logger.warn(`[UPDATE XP]: ${this.logInfo}: no slayer data found`);
			}

			/**
			 * dungeons
			 */

			dungeonTypes.forEach(dungeonType => this[`${dungeonType}Xp`] = playerData.dungeons.dungeon_types[dungeonType]?.experience ?? 0);
			dungeonClasses.forEach(dugeonClass => this[`${dugeonClass}Xp`] = playerData.dungeons.player_classes[dugeonClass]?.experience ?? 0);

			// reset dungeons xp if no catacombs xp offset
			if (this.catacombsXp !== 0) {
				for (const offset of XP_OFFSETS) {
					if (this[`catacombsXp${offset}`] === 0) {
						logger.info(`[UPDATE XP]: ${this.logInfo}: resetting '${offset}' dungeon xp`);
						await this.resetXp({ offsetToReset: offset, typesToReset: [ ...dungeonTypes, ...dungeonClasses ] });
					}
				}
			}

			// no dungeons data found logging
			if (!Object.hasOwnProperty.call(playerData.dungeons?.dungeon_types?.catacombs ?? {}, 'experience') && !(new Date().getHours() % 6) && new Date().getMinutes() < this.client.config.getNumber('DATABASE_UPDATE_INTERVAL')) {
				logger.warn(`[UPDATE XP]: ${this.logInfo}: no dungeons data found`);
			}

			/**
			 * collections
			 */

			if (!Object.hasOwnProperty.call(playerData, 'collection') && !(new Date().getHours() % 6) && new Date().getMinutes() < this.client.config.getNumber('DATABASE_UPDATE_INTERVAL')) {
				logger.warn(`[UPDATE XP]: ${this.logInfo}: collections API disabled`);
			}

			await this.save();
		} catch (error) {
			if (error instanceof NonAPIError) return logger.warn(`[UPDATE XP]: ${this.logInfo}: ${error}`);

			if (error.name.startsWith('Sequelize')) return logger.error(`[UPDATE XP]: ${this.logInfo}: ${error}`);

			if (error instanceof TypeError || error instanceof RangeError) {
				return logger.error(`[UPDATE XP]: ${this.logInfo}:`, error);
			}

			logger.error(`[UPDATE XP]: ${this.logInfo}: ${error.name}${error.code ? ` ${error.code}` : ''}: ${error.message}`);
			this.client.config.set('HYPIXEL_SKYBLOCK_API_ERROR', 'true');
			if (rejectOnAPIError) throw error;
		}
	}

	/**
	 * updates discord roles and nickname
	 * @param {object} options
	 * @param {?string} [options.reason] role update reason for discord's audit logs
	 * @param {boolean} [options.shouldSendDm] wether to dm the user that they should include their ign somewhere in their nickname
	 */
	async updateDiscordMember({ reason: reasonInput = 'synced with ingame stats', shouldSendDm = false } = {}) {
		if (this.guildID === GUILD_ID_BRIDGER) return;

		let reason = reasonInput;

		const member = await this.discordMember ?? (reason = 'found linked discord tag', await this.linkUsingCache());

		if (this.guildID === GUILD_ID_ERROR) return this.removeFromGuild(); // player left the guild but discord member couldn't be updated for some reason

		if (!member) return; // no linked available discord member to update
		if (!member.roles.cache.has(this.client.config.get('VERIFIED_ROLE_ID'))) return logger.warn(`[UPDATE DISCORD MEMBER]: ${this.logInfo} | ${member.user.tag} | ${member.displayName}: missing verified role`);

		await this.updateRoles(reason);
		await this.syncIgnWithDisplayName(shouldSendDm);
	}

	/**
	 * updates the skyblock related discord roles using the db data
	 * @param {?string} reasonInput reason for discord's audit logs
	 */
	async updateRoles(reasonInput = null) {
		const member = await this.discordMember;

		if (!member) return;

		const { config } = this.client;
		const rolesToAdd = [];
		const rolesToRemove = [];

		let inGuild = false;
		let reason = reasonInput;

		// individual hypixel guild roles
		for (const [ guildID, { roleID }] of this.client.hypixelGuilds.cache) {
			// player is in the guild
			if (guildID === this.guildID) {
				if (!member.roles.cache.has(roleID)) rolesToAdd.push(roleID);
				inGuild = true;

			// player is not in the guild
			} else if (member.roles.cache.has(roleID)) {
				rolesToRemove.push(roleID);
			}
		}

		// player is not in a guild from <LunarClient>.hypixelGuilds
		if (!inGuild) {
			if (member.roles.cache.has(config.get('GUILD_ROLE_ID'))) rolesToRemove.push(config.get('GUILD_ROLE_ID'));
			return this.makeRoleApiCall(rolesToAdd, rolesToRemove, reason);
		}

		// combined guild roles
		if (!member.roles.cache.has(config.get('GUILD_ROLE_ID'))) rolesToAdd.push(config.get('GUILD_ROLE_ID'));
		if (member.roles.cache.has(config.get('EX_GUILD_ROLE_ID'))) rolesToRemove.push(config.get('EX_GUILD_ROLE_ID'));

		// guild delimiter role (only if it doesn't overwrite current colour role, delimiters have invis colour)
		if (member.roles.color?.comparePositionTo(member.guild.roles.cache.get(config.get('GUILD_DELIMITER_ROLE_ID'))) > 1) {
			if (!member.roles.cache.has(config.get('GUILD_DELIMITER_ROLE_ID'))) rolesToAdd.push(config.get('GUILD_DELIMITER_ROLE_ID'));
		} else if (member.roles.cache.has(config.get('GUILD_DELIMITER_ROLE_ID'))) {
			rolesToRemove.push(config.get('GUILD_DELIMITER_ROLE_ID'));
		}

		// other delimiter roles
		for (let i = 1; i < delimiterRoles.length; ++i) {
			if (!member.roles.cache.has(config.get(`${delimiterRoles[i]}_DELIMITER_ROLE_ID`))) rolesToAdd.push(config.get(`${delimiterRoles[i]}_DELIMITER_ROLE_ID`));
		}

		// hypixel guild ranks
		const { guildRank } = this;

		if (guildRank) {
			if (guildRank.roleID && !member.roles.cache.has(guildRank.roleID)) {
				reason = 'synced with ingame rank';
				rolesToAdd.push(guildRank.roleID);
			}

			if (!this.isStaff) { // non staff rank -> remove other ranks
				for (const rank of this.guild.ranks.filter(({ roleID, priority }) => roleID && priority !== this.guildRankPriority)) {
					if (member.roles.cache.has(rank.roleID)) rolesToRemove.push(rank.roleID);
				}
			}
		}

		// skills
		const skillAverage = skills
			.map((skill) => { // individual skill lvl 45+ / 50+ / 55+ / 60
				const { progressLevel } = this.getSkillLevel(skill);
				const CURRENT_LEVEL_MILESTONE = Math.floor(progressLevel / 5) * 5; // round down to nearest divisible by 5

				// individual skills
				for (const level of skillRoles) {
					if (level === CURRENT_LEVEL_MILESTONE) {
						if (!member.roles.cache.has(config.get(`${skill}_${level}_ROLE_ID`))) rolesToAdd.push(config.get(`${skill}_${level}_ROLE_ID`));
					} else if (member.roles.cache.has(config.get(`${skill}_${level}_ROLE_ID`))) {
						rolesToRemove.push(config.get(`${skill}_${level}_ROLE_ID`));
					}
				}

				return progressLevel;
			})
			.reduce((acc, level) => acc + level, 0) / skills.length;

		// average skill
		let currentLvlMilestone = Math.floor(skillAverage / 5) * 5; // round down to nearest divisible by 5

		for (const level of skillAverageRoles) {
			if (level === currentLvlMilestone) {
				if (!member.roles.cache.has(config.get(`AVERAGE_LVL_${level}_ROLE_ID`))) rolesToAdd.push(config.get(`AVERAGE_LVL_${level}_ROLE_ID`));
			} else if (member.roles.cache.has(config.get(`AVERAGE_LVL_${level}_ROLE_ID`))) {
				rolesToRemove.push(config.get(`AVERAGE_LVL_${level}_ROLE_ID`));
			}
		}

		// slayers
		const LOWEST_SLAYER_LVL = Math.min(...slayers.map((slayer) => {
			const SLAYER_LVL = this.getSlayerLevel(slayer);

			// individual slayer
			for (const level of slayerRoles) {
				if (level === SLAYER_LVL) {
					if (!member.roles.cache.has(config.get(`${slayer}_${level}_ROLE_ID`))) rolesToAdd.push(config.get(`${slayer}_${level}_ROLE_ID`));
				} else if (member.roles.cache.has(config.get(`${slayer}_${level}_ROLE_ID`))) {
					rolesToRemove.push(config.get(`${slayer}_${level}_ROLE_ID`));
				}
			}

			return SLAYER_LVL;
		}));

		// total slayer
		for (const level of slayerTotalRoles) {
			if (level % 10 === LOWEST_SLAYER_LVL) {
				if (!member.roles.cache.has(config.get(`SLAYER_${level}_ROLE_ID`))) rolesToAdd.push(config.get(`SLAYER_${level}_ROLE_ID`));
			} else if (member.roles.cache.has(config.get(`SLAYER_${level}_ROLE_ID`))) {
				rolesToRemove.push(config.get(`SLAYER_${level}_ROLE_ID`));
			}
		}

		// dungeons
		currentLvlMilestone = Math.floor(this.getSkillLevel('catacombs').trueLevel / 5) * 5; // round down to nearest divisible by 5

		for (const level of catacombsRoles) {
			if (level === currentLvlMilestone) {
				if (!member.roles.cache.has(config.get(`CATACOMBS_${level}_ROLE_ID`))) rolesToAdd.push(config.get(`CATACOMBS_${level}_ROLE_ID`));
			} else if (member.roles.cache.has(config.get(`CATACOMBS_${level}_ROLE_ID`))) {
				rolesToRemove.push(config.get(`CATACOMBS_${level}_ROLE_ID`));
			}
		}

		return this.makeRoleApiCall(rolesToAdd, rolesToRemove, reason);
	}

	/**
	 * tries to link unlinked players via discord.js-cache (without any discord API calls)
	 * @returns {Promise<?LunarGuildMember>}
	 */
	async linkUsingCache() {
		const { lgGuild } = this.client;

		if (!lgGuild) return null;

		let member;

		if (this.discordID) { // tag or ID known
			member = /\D/.test(this.discordID)
				? lgGuild.members.cache.find(({ user: { tag } }) => tag === this.discordID) // tag known
				: lgGuild.members.cache.get(this.discordID); // id known

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
	 * validates the discordID and only updates it if the validation passes
	 * @param {string} value
	 */
	async setValidDiscordID(value) {
		const OLD_DISCORD_ID = this.discordID;

		try {
			this.discordID = value;
			await this.save({ fields: [ 'discordID' ] });
		} catch (error) {
			this.discordID = OLD_DISCORD_ID;
			throw error;
		}
	}

	/**
	 * links a player to the provided discord guild member, updating roles and nickname
	 * @param {LunarGuildMember|string} idOrDiscordMember the member to link the player to
	 * @param {string} reason reason for discord's audit logs
	 */
	async link(idOrDiscordMember, reason = null) {
		if (idOrDiscordMember instanceof LunarGuildMember) {
			await this.setValidDiscordID(idOrDiscordMember.id);
			this.inDiscord = true;
			this.discordMember = idOrDiscordMember;

			logger.info(`[LINK]: ${this.logInfo}: linked to '${idOrDiscordMember.user.tag}'`);

			if (reason) await this.update({ reason });
		} else if (typeof idOrDiscordMember === 'string' && validateNumber(idOrDiscordMember)) {
			await this.setValidDiscordID(idOrDiscordMember);
			this.inDiscord = false;
		} else {
			throw new Error('[LINK]: input must be either a discord GuildMember or a discord ID');
		}

		return this.save();
	}

	/**
	 * unlinks a player from a discord member, purging roles and nickname
	 * @param {string} reason reason for discord's audit logs
	 */
	async unlink(reason = null) {
		const currentLinkedMember = await this.discordMember;

		// unlink 1/2
		this.discordID = null; // needs to be set before so that client.on('guildMemberUpdate', ...) doesn't change the nickname back to the ign

		let wasSuccessful = true;

		if (currentLinkedMember) {
			// remove roles that the bot manages
			const { rolesToPurge } = currentLinkedMember;

			if (rolesToPurge.length) wasSuccessful = await this.makeRoleApiCall([], rolesToPurge, reason);

			// reset nickname if it is set to the player's ign
			if (currentLinkedMember.nickname === this.ign) wasSuccessful = (await this.makeNickApiCall(null, false, reason)) && wasSuccessful;

			// unlink player from member
			currentLinkedMember.player = null;
		}

		// unlink 2/2
		this.inDiscord = false;
		await this.save();

		return wasSuccessful;
	}

	/**
	 * adds and/or removes the provided roles and logs it via webhook, returns true or false depending on the success
	 * @param {string[]} rolesToAdd roles to add to the member
	 * @param {string[]} rolesToRemove roles to remove from the member
	 * @param {string} reason reason for discord's audit logs
	 * @returns {Promise<boolean>} wether the API call was successful
	 */
	async makeRoleApiCall(rolesToAdd = [], rolesToRemove = [], reason = null) {
		const member = await this.discordMember;

		if (!member) return;

		// check if valid IDs are provided
		let filteredRolesToAdd = rolesToAdd.filter(x => x != null);
		let filteredRolesToRemove = rolesToRemove.filter(x => x != null);
		if (!filteredRolesToAdd.length && !filteredRolesToRemove.length) return;

		// permission check
		if (!member.guild.me.permissions.has(MANAGE_ROLES)) return logger.warn(`[ROLE API CALL]: missing 'MANAGE_ROLES' in '${member.guild.name}'`);

		const { config } = member.client;
		const IS_ADDING_GUILD_ROLE = filteredRolesToAdd.includes(config.get('GUILD_ROLE_ID'));

		// check if IDs are proper roles and managable by the bot
		filteredRolesToAdd = member.guild.verifyRoleIDs(filteredRolesToAdd);
		filteredRolesToRemove = member.guild.verifyRoleIDs(filteredRolesToRemove);
		if (!filteredRolesToAdd.size && !filteredRolesToRemove.size) return;

		const loggingEmbed = new MessageEmbed()
			.setAuthor(member.user.tag, member.user.displayAvatarURL({ dynamic: true }), this.url)
			.setThumbnail(this.image)
			.setDescription(stripIndents`
				**Role Update** for ${member}
				${this.info}
			`)
			.setTimestamp();

		try {
			// api call
			this.discordMember = await member.roles.set(member.roles.cache.filter((_, roleID) => !filteredRolesToRemove.has(roleID)).concat(filteredRolesToAdd), reason);

			// was successful
			loggingEmbed.setColor(IS_ADDING_GUILD_ROLE ? config.get('EMBED_GREEN') : config.get('EMBED_BLUE'));
			if (filteredRolesToAdd.size) loggingEmbed.addField('Added', `\`\`\`\n${filteredRolesToAdd.map(({ name }) => name).join('\n')}\`\`\``, true);
			if (filteredRolesToRemove.size) loggingEmbed.addField('Removed', `\`\`\`\n${filteredRolesToRemove.map(({ name }) => name).join('\n')}\`\`\``, true);
			return true;
		} catch (error) {
			// was not successful
			this.discordMember = null;
			logger.error(`[ROLE API CALL]: ${error}`);
			loggingEmbed
				.setColor(config.get('EMBED_RED'))
				.addField(error.name, error.message);
			if (filteredRolesToAdd.size) loggingEmbed.addField('Failed to add', `\`\`\`\n${filteredRolesToAdd.map(({ name }) => name).join('\n')}\`\`\``, true);
			if (filteredRolesToRemove.size) loggingEmbed.addField('Failed to remove', `\`\`\`\n${filteredRolesToRemove.map(({ name }) => name).join('\n')}\`\`\``, true);
			return false;
		} finally {
			// logging
			await member.client.log(loggingEmbed.padFields(2));
		}
	}

	/**
	 * removes the discord server ingame guild role & all roles handled automatically by the bot
	 * @returns {Promise<boolean>} wether the discord role removal was successful or not
	 */
	async removeFromGuild() {
		const member = await this.discordMember;

		let isBridger = false;

		if (member) {
			const { config } = this.client;
			const rolesToAdd = (Date.now() - this.createdAt >= 7 * 24 * 60 * 60_000) && !member.roles.cache.has(config.get('EX_GUILD_ROLE_ID'))
				? [ config.get('EX_GUILD_ROLE_ID') ] // add ex guild role if player stayed for more than 1 week
				: [];
			const rolesToRemove = member.rolesToPurge;

			if (!(await this.makeRoleApiCall(rolesToAdd, rolesToRemove, `left ${this.guildName}`))) {
				// error updating roles
				logger.warn(`[REMOVE FROM GUILD]: ${this.logInfo}: unable to update roles`);
				this.guildID = GUILD_ID_ERROR;
				this.save();
				return false;
			}

			isBridger = member.roles.cache.has(config.get('BRIDGER_ROLE_ID'));
		} else {
			logger.info(`[REMOVE FROM GUILD]: ${this.logInfo}: left without being in the discord`);
		}

		this.guildID = isBridger
			? GUILD_ID_BRIDGER
			: null;
		this.guildRankPriority = 0;
		this.save();

		if (!isBridger) this.client.players.delete(this);

		return true;
	}

	/**
	 * check if the discord member's display name includes the player ign and is unique. Tries to change it if it doesn't / isn't
	 * @param {boolean} shouldSendDm wether to dm the user that they should include their ign somewhere in their nickname
	 */
	async syncIgnWithDisplayName(shouldSendDm = false) {
		if (this.guildID === GUILD_ID_BRIDGER) return;

		const member = await this.discordMember;

		if (!member) return;

		let reason = 0;

		if (!member.displayName.toLowerCase().includes(this.ign.toLowerCase())) reason = 1; // nickname doesn't include ign
		if (member.guild.members.cache.find(({ displayName, id }) => displayName.toLowerCase() === member.displayName.toLowerCase() && id !== member.id)?.player) reason = 2; // two guild members share the same display name

		if (!reason) return;
		if (this.ign === UNKNOWN_IGN) return; // mojang api error

		// check if member already has a nick which is not just the current ign (case insensitive)
		let newNick = member.nickname && member.nickname.toLowerCase() !== this.ign.toLowerCase()
			? `${trim(member.nickname, NICKNAME_MAX_CHARS - this.ign.length - 3)} (${this.ign})`
			: this.ign;

		// 'nick (ign)' already exists
		if (member.guild.members.cache.find(({ displayName, id }) => displayName.toLowerCase() === newNick.toLowerCase() && id !== member.id)?.player) {
			newNick = this.ign;
		}

		return this.makeNickApiCall(newNick, shouldSendDm, reason);
	}

	/**
	 * sets a nickname for the player's discord member
	 * @param {?string} newNick new nickname, null to remove the current nickname
	 * @param {boolean} shouldSendDm wether to dm the user that they should include their ign somewhere in their nickname
	 * @param {?number|string} reason reason for discord's audit logs and the DM
	 * @returns {Promise<boolean>} wether the API call was successful
	 */
	async makeNickApiCall(newNick = null, shouldSendDm = false, reason = null) {
		const member = await this.discordMember;

		if (!member) return;
		if (member.guild.me.roles.highest.comparePositionTo(member.roles.highest) < 1) return; // member's highest role is above bot's highest role
		if (member.guild.ownerID === member.id) return; // can't change nick of owner
		if (!member.guild.me.permissions.has('MANAGE_NICKNAMES')) return logger.warn(`[SYNC IGN DISPLAYNAME]: ${this.logInfo}: missing 'MANAGE_NICKNAMES' permission`);

		const { displayName: PREV_NAME } = member;

		try {
			this.discordMember = await member.setNickname(
				newNick,
				reason == null
					? null
					: typeof reason === 'string'
						? reason
						: reason === 1
							? 'name didn\'t contain ign'
							: 'name already taken',
			);

			await this.client.log(new MessageEmbed()
				.setColor(this.client.config.get('EMBED_BLUE'))
				.setAuthor(member.user.tag, member.user.displayAvatarURL({ dynamic: true }), this.url)
				.setThumbnail(this.image)
				.setDescription(stripIndents`
					**Nickname Update** for ${member}
					${this.info}
				`)
				.addFields(
					{ name: 'Old nickname', value: `\`\`\`${PREV_NAME}\`\`\``, inline: true },
					{ name: 'New nickname', value: `\`\`\`${newNick ?? member.user.username}\`\`\``, inline: true },
				)
				.setTimestamp(),
			);

			if (shouldSendDm) {
				await member
					.send(reason === 1
						? stripIndents`
							include your ign \`${this.ign}\` somewhere in your nickname.
							If you just changed your ign, wait up to ${this.client.config.get('DATABASE_UPDATE_INTERVAL')} minutes and ${this.client.user} will automatically change your discord nickname
						`
						: stripIndents`
							the name \`${PREV_NAME}\` is already taken by another guild member.
							Your name should be unique to allow staff members to easily identify you
						`,
					).then(
						() => logger.info(`[SYNC IGN DISPLAYNAME]: ${this.logInfo}: sent nickname info DM`),
						error => logger.error(`[SYNC IGN DISPLAYNAME]: ${this.logInfo}: unable to DM: ${error}`),
					);
			}

			return true;
		} catch (error) {
			logger.error(`[SYNC IGN DISPLAYNAME]: ${this.logInfo}: ${error}`);
			this.discordMember = null;
			return false;
		}
	}

	/**
	 * fetches the discord tag from hypixel
	 */
	async fetchDiscordTag() {
		return (await hypixel.player.uuid(this.minecraftUUID).catch(error => logger.error(`[FETCH DISCORD TAG]: ${this.logInfo}: ${error.name}${error.code ? ` ${error.code}` : ''}: ${error.message}`)))?.socialMedia?.links?.DISCORD ?? null;
	}

	/**
	 * determines the player's main profile (profile with the most weight)
	 */
	async fetchMainProfile() {
		const profiles = await hypixel.skyblock.profiles.uuid(this.minecraftUUID);

		if (!profiles.length) {
			this.mainProfileID = null;
			this.save();

			throw new NonAPIError(`${this.logInfo}: no SkyBlock profiles`);
		}

		const { profile_id: PROFILE_ID, cute_name: PROFILE_NAME } = profiles[
			profiles.length > 1
				? profiles
					.map(({ members }) => getWeight(members[this.minecraftUUID]).total)
					.reduce((bestIndexSoFar, currentlyTestedValue, currentlyTestedIndex, array) => (currentlyTestedValue > array[bestIndexSoFar] ? currentlyTestedIndex : bestIndexSoFar), 0)
				: 0
		];

		if (PROFILE_ID === this.mainProfileID) return null;

		const { mainProfileName } = this;

		this.mainProfileID = PROFILE_ID;
		this.mainProfileName = PROFILE_NAME;
		this.save();

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
			const { ign: CURRENT_IGN } = await mojang.uuid(this.minecraftUUID, { force: true });

			if (CURRENT_IGN === this.ign) return null;

			const { ign: OLD_IGN } = this;

			try {
				this.ign = CURRENT_IGN;
				await this.save();
			} catch (error) {
				this.ign = OLD_IGN;
				return logger.error(`[UPDATE IGN]: ${this.logInfo}: ${error}`);
			}

			this.syncIgnWithDisplayName(false);

			return {
				oldIgn: OLD_IGN,
				newIgn: CURRENT_IGN,
			};
		} catch (error) {
			logger.error(`[UPDATE IGN]: ${this.logInfo}: ${error}`);
		}
	}

	/**
	 * transfers xp offsets
	 * @param {obejct} options
	 * @param {string} options.from
	 * @param {string} options.to
	 * @param {?string[]} [options.types]
	 */
	async transferXp({ from, to, types = XP_TYPES }) {
		for (const type of types) {
			this[`${type}Xp${to}`] = this[`${type}Xp${from}`];
		}

		return this.save();
	}

	/**
	 * resets the xp gained to 0
	 * @param {object} options
	 * @param {?string} options.offsetToReset
	 * @param {?string[]} options.typesToReset
	 * @returns {Promise<this>}
	 */
	async resetXp({ offsetToReset = null, typesToReset = XP_TYPES } = {}) {
		switch (offsetToReset) {
			case null:
				// no offset type specifies -> resetting everything
				await Promise.all(XP_OFFSETS.map(async offset => this.resetXp({ offsetToReset: offset, typesToReset })));
				return this.resetXp({ offsetToReset: DAY, typesToReset });

			case DAY:
				// append current xp to the beginning of the xpHistory-Array and pop of the last value
				typesToReset.forEach((type) => {
					/**
					 * @type {number[]}
					 */
					const xpHistory = this[`${type}XpHistory`];
					xpHistory.shift();
					xpHistory.push(this[`${type}Xp`]);
					this.changed(`${type}XpHistory`, true); // neccessary so that sequelize knows an array has changed and the db needs to be updated
				});
				break;

			case CURRENT:
				typesToReset.forEach(type => this[`${type}Xp`] = 0);
				break;

			default:
				typesToReset.forEach(type => this[`${type}Xp${offsetToReset}`] = this[`${type}Xp`]);
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
				from: this.minecraftUUID,
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
	 * @typedef {object} setToPaidOptions
	 * @property {?number} [amount] paid amount
	 * @property {?string} [collectedBy] minecraft uuid of the player who collected
	 * @property {?string} [auctionID] hypixel auction uuid
	 */

	/**
	 * set the player to paid
	 * @param {setToPaidOptions} param0
	 */
	async setToPaid({ amount = this.client.config.getNumber('TAX_AMOUNT'), collectedBy = this.minecraftUUID, auctionID = null } = {}) {
		if (this.paid) {
			await Promise.all(this.addTransfer({ amount, collectedBy, auctionID, type: 'donation' }));
		} else {
			const overflow = Math.max(amount - this.client.config.getNumber('TAX_AMOUNT'), 0); // >=
			const taxAmount = amount - overflow;
			const promises = this.addTransfer({ amount: taxAmount, collectedBy, auctionID, type: 'tax' });

			if (overflow) promises.push(...this.addTransfer({ amount: overflow, collectedBy, auctionID, type: 'donation' }));

			await Promise.all(promises);

			this.paid = true;
		}

		return this.save();
	}

	/**
	 * set the player to paid
	 * @param {setToPaidOptions} options
	 * @param {?string} [options.type=tax]
	 * @param {?string} [options.notes]
	 * @returns {[Promise<import('./TaxCollector')>, Promise<(import('./Transaction'))>]}
	 */
	addTransfer({ amount, collectedBy, auctionID = null, notes = null, type = 'tax' } = {}) {
		return [
			this.client.taxCollectors.cache.get(collectedBy)?.addAmount(amount, type), // update taxCollector
			this.client.db.models.Transaction.create({
				from: this.minecraftUUID,
				to: collectedBy,
				amount,
				auctionID,
				notes,
				type,
			}),
		];
	}

	/**
	 * destroys the db entry and removes it from the client.players collection
	 */
	async delete() {
		return this.client.players.remove(this);
	}

	/**
	 * updates the guild xp and syncs guild mutes
	 * @param {import('@zikeji/hypixel').Components.Schemas.GuildMember} data from the hypixel guild API
	 * @param {import('./HypixelGuild')} hypixelGuilds
	 */
	async syncWithGuildData({ expHistory = {}, mutedTill, rank }, hypixelGuild = this.guild) {
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
		} else if (this.client.config.getBoolean('EXTENDED_LOGGING_ENABLED')) {
			logger.warn(`[UPDATE GUILD XP]: ${this.logInfo}: no guild xp found`);
		}

		// sync guild mutes
		if (mutedTill) {
			this.chatBridgeMutedUntil = mutedTill;
		}

		// update guild rank
		this.guildRankPriority = hypixelGuild.ranks.find(({ name }) => name === rank)?.priority ?? (/guild ?master/i.test(rank) ? hypixelGuild.ranks.length : 1);

		return this.save();
	}

	/**
	 * returns the true and progression level for the provided skill type
	 * @param {string} type the skill or dungeon type
	 * @param {string} [offset=''] optional offset value to use instead of the current xp value
	 * @param {boolean} [useIndividualCap=true] wether to use the individual max level cap if existing
	 */
	getSkillLevel(type, offset = '', useIndividualCap = true) {
		return getSkillLevel(type, this[`${type}Xp${offset}`], type === 'farming' && useIndividualCap ? this.farmingLvlCap : null);
	}

	/**
	 * returns the true and progression skill average
	 * @param {string} offset optional offset value to use instead of the current xp value
	 */
	getSkillAverage(offset = '') {
		const SKILL_COUNT = skills.length;

		let skillAverage = 0;
		let trueAverage = 0;

		skills.forEach((skill) => {
			const { trueLevel, nonFlooredLevel } = this.getSkillLevel(skill, offset);

			skillAverage += nonFlooredLevel;
			trueAverage += trueLevel;
		});

		return {
			skillAverage: Number((skillAverage / SKILL_COUNT).toFixed(2)),
			trueAverage: Number((trueAverage / SKILL_COUNT).toFixed(2)),
		};
	}

	/**
	 * returns the slayer level for the provided slayer type
	 * @param {string} type the slayer type
	 */
	getSlayerLevel(type) {
		const xp = this[`${type}Xp`];
		const maxLevel = Math.max(...Object.keys(slayerXp));

		let level = 0;

		for (let x = 1; x <= maxLevel && slayerXp[x] <= xp; ++x) {
			level = x;
		}

		return level;
	}

	/**
	 * returns the total slayer xp
	 * @param {string} offset optional offset value to use instead of the current xp value
	 */
	getSlayerTotal(offset = '') {
		return slayers.reduce((acc, slayer) => acc + this[`${slayer}Xp${offset}`], 0);
	}

	/**
	 * calculates the player's weight using Senither's formula
	 * @param {string} offset optional offset value to use instead of the current xp value
	 */
	getWeight(offset = '') {
		let weight = 0;
		let overflow = 0;

		for (const skill of skills) {
			const { nonFlooredLevel: level } = this.getSkillLevel(skill, offset, false);
			const xp = this[`${skill}Xp${offset}`];
			const maxXp = levelingXpTotal[skillsCap[skill]];

			weight += ((level * 10) ** (0.5 + SKILL_EXPONENTS[skill] + (level / 100))) / 1250;
			if (xp > maxXp) overflow += ((xp - maxXp) / SKILL_DIVIDER[skill]) ** 0.968;
		}

		for (const slayer of slayers) {
			const experience = this[`${slayer}Xp${offset}`];

			if (experience <= 1_000_000) {
				weight += experience === 0
					? 0
					: experience / SLAYER_DIVIDER[slayer];
			} else {
				weight += 1_000_000 / SLAYER_DIVIDER[slayer];

				// calculate overflow
				let remaining = experience - 1_000_000;
				let modifier = SLAYER_MODIFIER[slayer];

				while (remaining > 0) {
					const left = Math.min(remaining, 1_000_000);

					weight += (left / (SLAYER_DIVIDER[slayer] * (1.5 + modifier))) ** 0.942;
					modifier += SLAYER_MODIFIER[slayer];
					remaining -= left;
				}
			}
		}


		const maxXp = Object.values(dungeonXp).reduce((acc, xp) => acc + xp, 0);

		for (const type of [ ...dungeonTypes, ...dungeonClasses ]) {
			const { nonFlooredLevel: level } = this.getSkillLevel(type, offset);
			const base = (level ** 4.5) * DUNGEON_EXPONENTS[type];
			const xp = this[`${type}Xp${offset}`];

			weight += base;
			if (xp > maxXp) overflow += ((xp - maxXp) / (4 * maxXp / base)) ** 0.968;
		}

		return {
			weight,
			overflow,
			totalWeight: weight + overflow,
		};
	}

	/**
	 * returns the true and progression level for the provided skill type
	 * @param {string} type the skill or dungeon type
	 * @param {number} index xpHistory array index
	 */
	getSkillLevelHistory(type, index) {
		return getSkillLevel(type, this[`${type}XpHistory`][index], type === 'farming' ? this.farmingLvlCap : null);
	}

	/**
	 * returns the true and progression skill average
	 * @param {number} index xpHistory array index
	 */
	getSkillAverageHistory(index) {
		const SKILL_COUNT = skills.length;

		let skillAverage = 0;
		let trueAverage = 0;

		skills.forEach((skill) => {
			const { trueLevel, nonFlooredLevel } = this.getSkillLevelHistory(skill, index);

			skillAverage += nonFlooredLevel;
			trueAverage += trueLevel;
		});

		return {
			skillAverage: Number((skillAverage / SKILL_COUNT).toFixed(2)),
			trueAverage: Number((trueAverage / SKILL_COUNT).toFixed(2)),
		};
	}

	/**
	 * returns the total slayer xp
	 * @param {string} offset optional offset value to use instead of the current xp value
	 * @param {number} index xpHistory array index
	 */
	getSlayerTotalHistory(index) {
		return slayers.reduce((acc, slayer) => acc + this[`${slayer}XpHistory`][index], 0);
	}

	/**
	 * calculates the player's weight using Senither's formula
	 * @param {number} index xpHistory array index
	 */
	getWeightHistory(index) {
		let weight = 0;
		let overflow = 0;

		for (const skill of skills) {
			const { nonFlooredLevel: level } = this.getSkillLevelHistory(skill, index);
			const xp = this[`${skill}XpHistory`][index];
			const maxXp = levelingXpTotal[skillsCap[skill]];

			weight += ((level * 10) ** (0.5 + SKILL_EXPONENTS[skill] + (level / 100))) / 1250;
			if (xp > maxXp) overflow += ((xp - maxXp) / SKILL_DIVIDER[skill]) ** 0.968;
		}

		for (const slayer of slayers) {
			const experience = this[`${slayer}XpHistory`][index];

			if (experience <= 1_000_000) {
				weight += experience === 0
					? 0
					: experience / SLAYER_DIVIDER[slayer];
			} else {
				weight += 1_000_000 / SLAYER_DIVIDER[slayer];

				// calculate overflow
				let remaining = experience - 1_000_000;
				let modifier = SLAYER_MODIFIER[slayer];

				while (remaining > 0) {
					const left = Math.min(remaining, 1_000_000);

					weight += (left / (SLAYER_DIVIDER[slayer] * (1.5 + modifier))) ** 0.942;
					modifier += SLAYER_MODIFIER[slayer];
					remaining -= left;
				}
			}
		}

		const maxXp = Object.values(dungeonXp).reduce((acc, xp) => acc + xp, 0);

		for (const type of [ ...dungeonTypes, ...dungeonClasses ]) {
			const { nonFlooredLevel: level } = this.getSkillLevelHistory(type, index);
			const base = (level ** 4.5) * DUNGEON_EXPONENTS[type];
			const xp = this[`${type}XpHistory`][index];

			weight += base;
			if (xp > maxXp) overflow += ((xp - maxXp) / (4 * maxXp / base)) ** 0.968;
		}

		return {
			weight,
			overflow,
			totalWeight: weight + overflow,
		};
	}

	/**
	 * player nickname
	 */
	toString() {
		return this.ign;
	}
};
