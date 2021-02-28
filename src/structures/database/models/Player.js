'use strict';

const { MessageEmbed } = require('discord.js');
const { Model, DataTypes } = require('sequelize');
const { stripIndents } = require('common-tags');
const { XP_TYPES, XP_OFFSETS, UNKNOWN_IGN, GUILD_ID_ERROR, GUILD_ID_BRIDGER } = require('../../../constants/database');
const { LEVELING_XP, SKILL_XP_PAST_50, SKILLS_CAP, RUNECRAFTING_XP, DUNGEON_XP, SLAYER_XP, SKILLS, COSMETIC_SKILLS, SLAYERS, DUNGEON_TYPES, DUNGEON_CLASSES } = require('../../../constants/skyblock');
const { SKILL_EXPONENTS, SKILL_DIVIDER, SLAYER_DIVIDER, DUNGEON_EXPONENTS } = require('../../../constants/weight');
const { escapeIgn, getHypixelClient } = require('../../../functions/util');
const LunarGuildMember = require('../../extensions/GuildMember');
const mojang = require('../../../api/mojang');
const logger = require('../../../functions/logger');


module.exports = class Player extends Model {
	constructor(...args) {
		super(...args);

		/**
		 * @type {?LunarGuildMember|Promise<?LunarGuildMember>}
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
		XP_TYPES.forEach(type => {
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

			XP_OFFSETS.forEach(offset => {
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

	/**
	 * returns the hypixel guild db object associated with the player
	 * @returns {?import('./HypixelGuild')}
	 */
	get guild() {
		if (this.guildID === GUILD_ID_BRIDGER) return this.client.hypixelGuilds.cache.get(this.client.config.get('MAIN_GUILD_ID')) ?? logger.warn(`[GET GUILD]: ${this.ign}: no guild with the id '${this.guildID}' found`);
		return this.client.hypixelGuilds.cache.get(this.guildID) ?? logger.warn(`[GET GUILD]: ${this.ign}: no guild with the id '${this.guildID}' found`);
	}

	/**
	 * wether the player is a bridger or error case
	 */
	get notInGuild() {
		return [ GUILD_ID_BRIDGER, GUILD_ID_ERROR ].includes(this.guildID);
	}

	/**
	 * fetches the discord member if the discord id is valid and the player is in lg discord
	 * @returns {?LunarGuildMember|Promise<?LunarGuildMember>}
	 */
	get discordMember() {
		if (!this._discordMember) this._discordMember = (() => {
			if (!this.inDiscord) return null;

			return this.client.lgGuild?.members
				.fetch(this.discordID)
				.catch(error => {
					this.inDiscord = false; // prevent further fetches and try to link via cache in the next xpUpdate iterations
					this.save();
					return logger.error(`[GET DISCORD MEMBER]: error while fetching ${this.ign}'s discord data: ${error.name}: ${error.message}`);
				})
				?? null;
		})();

		return this._discordMember;
	}

	/**
	 * fetches the discord user if the discord id is valid
	 * @returns {Promise<?import('../../extensions/User')>}
	 */
	get discordUser() {
		return /^\d+$/.test(this.discordID)
			? this.client.users.fetch(this.discordID)
			: null;
	}

	/**
	 * populates the discord member cache
	 */
	set discordMember(member) {
		this._discordMember = member;
	}

	/**
	 * returns the guild rank of the player
	 * @returns {?import('./HypixelGuild').GuildRank}
	 */
	get guildRank() {
		return this.guild?.ranks?.find(rank => rank.priority === this.guildRankPriority) ?? null;
	}

	/**
	 * returns the player's guild name
	 * @returns {string}
	 */
	get guildName() {
		return this.guild?.name ?? 'unknown guild';
	}

	/**
	 * returns a string with the ign and guild name
	 */
	get info() {
		return `${escapeIgn(this.ign)} | ${this.guildName}`; // •
	}

	/**
	 * returns a string with the ign and guild name
	 * @returns {string}
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
	 * wether the player has an ingame staff rank
	 * assumes the last two guild ranks are staff ranks
	 */
	get isStaff() {
		return this.guildRankPriority && this.guildRankPriority >= this.guild?.ranks.length - 1;
	}

	/**
	 * @returns {Promise<?number>}
	 */
	get taxAmount() {
		return this.client.db.models.Transaction.findAll({
			limit: 1,
			where: {
				from: this.minecraftUUID,
				type: 'tax',
			},
			order: [[ 'createdAt', 'DESC' ]],
			attributes: [ 'amount' ],
			raw: true,
		}).then(result => result.lengh ? result[0].amount : null);
	}

	/**
	 * updates the player data and discord member
	 * @param {object} options
	 * @param {boolean} [options.shouldSkipQueue] wether to use the hypixel aux client when the main one's request queue is filled
	 * @param {?string} [options.reason] role update reason for discord's audit logs
	 * @param {boolean} [options.shouldSendDm] wether to dm the user that they should include their ign somewhere in their nickname
	 */
	async update({ shouldSkipQueue = false, reason = 'synced with ingame stats', shouldSendDm = false } = {}) {
		if (this.guildID === GUILD_ID_BRIDGER) { // bridgers
			const result = await this.updateIgn();
			return result && this.client.log(new MessageEmbed()
				.setColor(this.client.config.get('EMBED_BLUE'))
				.setTitle('Bridger Database: 1 change')
				.addFields( // max value#length is 1024
					{ name: `${'joined'.padEnd(75, '\xa0')}\u200b`, value: '```\u200b```', inline: true },
					{ name: `${'left'.padEnd(75, '\xa0')}\u200b`, value: '```\u200b```', inline: true },
					{ name: `${'new ign'.padEnd(75, '\xa0')}\u200b`, value: `\`\`\`\n${`${result.oldIgn} -> ${result.newIgn}`}\`\`\``, inline: true },
				)
				.setTimestamp(),
			);
		}

		if (this.guildID !== GUILD_ID_ERROR) await this.updateXp({ shouldSkipQueue }); // only query hypixel skyblock api for guild players error

		await this.updateDiscordMember({ reason, shouldSendDm });
	}

	/**
	 * updates skill and slayer xp
	 * @param {object} options
	 * @param {boolean} [options.shouldSkipQueue] wether to use the hypixel aux client when the main one's request queue is filled
	 */
	async updateXp({ shouldSkipQueue = false } = {}) {
		try {
			if (!this.mainProfileID) await this.fetchMainProfile(shouldSkipQueue); // detect main profile if it is unknown

			// hypixel API call (if shouldSkipQueue and hypixelMain queue already filled use hypixelAux)
			const { meta: { cached }, members } = (await getHypixelClient(shouldSkipQueue).skyblock.profile(this.mainProfileID));

			if (cached) throw new Error('cached data');

			const playerData = members[this.minecraftUUID];

			if (!playerData) {
				this.mainProfileID = null;
				this.save();
				throw new Error(`unable to find main profile named '${this.mainProfileName}' -> resetting name`);
			}

			this.xpLastUpdatedAt = Date.now();

			// update xp
			if (Object.prototype.hasOwnProperty.call(playerData, 'experience_skill_alchemy')) {
				SKILLS.forEach(skill => this[`${skill}Xp`] = playerData[`experience_skill_${skill}`] ?? 0);
				COSMETIC_SKILLS.forEach(skill => this[`${skill}Xp`] = playerData[`experience_skill_${skill}`] ?? 0);

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
				if (!(new Date().getHours() % 6) && new Date().getMinutes() < this.client.config.getNumber('DATABASE_UPDATE_INTERVAL')) logger.warn(`[UPDATE XP]: ${this.logInfo}: skill API disabled`);
				this.notes = 'skill api disabled';
			}

			this.farmingLvlCap = 50 + (playerData.jacob2?.perks.farming_level_cap ?? 0);

			if (Object.prototype.hasOwnProperty.call(playerData.slayer_bosses?.zombie ?? {}, 'xp')) {
				SLAYERS.forEach(slayer => this[`${slayer}Xp`] = playerData.slayer_bosses[slayer].xp ?? 0);

				// reset slayer xp if no zombie xp offset
				if (this.zombieXp !== 0) {
					for (const offset of XP_OFFSETS) {
						if (this[`zombieXp${offset}`] === 0) {
							logger.info(`[UPDATE XP]: ${this.logInfo}: resetting '${offset}' slayer xp`);
							await this.resetXp({ offsetToReset: offset, typesToReset: SLAYERS });
						}
					}
				}
			} else if (!(new Date().getHours() % 6) && new Date().getMinutes() < this.client.config.getNumber('DATABASE_UPDATE_INTERVAL')) {
				logger.warn(`[UPDATE XP]: ${this.logInfo}: no slayer data found`);
			}

			if (Object.hasOwnProperty.call(playerData.dungeons?.dungeon_types?.catacombs ?? {}, 'experience')) {
				DUNGEON_TYPES.forEach(dungeonType => this[`${dungeonType}Xp`] = playerData.dungeons.dungeon_types[dungeonType]?.experience ?? 0);
				DUNGEON_CLASSES.forEach(dugeonClass => this[`${dugeonClass}Xp`] = playerData.dungeons.player_classes[dugeonClass]?.experience ?? 0);

				// reset dungeon xp if no catacombs xp offset
				if (this.catacombsXp !== 0) {
					for (const offset of XP_OFFSETS) {
						if (this[`catacombsXp${offset}`] === 0) {
							logger.info(`[UPDATE XP]: ${this.logInfo}: resetting '${offset}' dungeon xp`);
							await this.resetXp({ offsetToReset: offset, typesToReset: [ ...DUNGEON_TYPES, ...DUNGEON_CLASSES ] });
						}
					}
				}
			} else if (!(new Date().getHours() % 6) && new Date().getMinutes() < this.client.config.getNumber('DATABASE_UPDATE_INTERVAL')) {
				logger.warn(`[UPDATE XP]: ${this.logInfo}: no dungeons data found`);
			}

			if (!Object.hasOwnProperty.call(playerData, 'collection') && !(new Date().getHours() % 6) && new Date().getMinutes() < this.client.config.getNumber('DATABASE_UPDATE_INTERVAL'))
				logger.warn(`[UPDATE XP]: ${this.logInfo}: collections API disabled`);

			await this.save();
		} catch (error) {
			logger.log(
				error.message === 'cached data' ? 'info' : 'error',
				`[UPDATE XP]: ${this.logInfo}: ${error.name}${error.code ? ` ${error.code}` : ''}: ${error.message}`,
			);
		}
	}

	/**
	 * updates discord roles and nickname
	 * @param {object} options
	 * @param {?string} [options.reason] role update reason for discord's audit logs
	 * @param {boolean} [options.shouldSendDm] wether to dm the user that they should include their ign somewhere in their nickname
	 */
	async updateDiscordMember({ reason = 'synced with ingame stats', shouldSendDm = false } = {}) {
		if (this.guildID === GUILD_ID_BRIDGER) return;

		const member = await this.discordMember ?? (reason = 'found linked discord tag', await this.linkUsingCache());

		if (this.guildID === GUILD_ID_ERROR) return this.removeFromGuild(); // player left the guild but discord member couldn't be updated for some reason

		if (!member) return; // no linked available discord member to update
		if (!member.roles.cache.has(this.client.config.get('VERIFIED_ROLE_ID'))) return logger.warn(`[UPDATE DISCORD MEMBER]: ${this.logInfo} | ${member.user.tag} | ${member.displayName}: missing verified role`);

		await this.updateRoles(reason);
		await this.syncIgnWithDisplayName(shouldSendDm);
	}

	/**
	 * updates the skyblock related discord roles using the db data
	 * @param {?string} reason reason for discord's audit logs
	 */
	async updateRoles(reason = null) {
		const member = await this.discordMember;

		if (!member) return;

		const { config } = this.client;
		const rolesToAdd = [];
		const rolesToRemove = [];

		// delimiter roles & guild role
		if (member.roles.highest.comparePositionTo(member.guild.roles.cache.get(config.get('GUILD_DELIMITER_ROLE_ID'))) > 1 && ![ config.get('SHRUG_ROLE_ID'), config.get('MUTED_ROLE_ID') ].includes(member.roles.highest.id)) {
			if (!member.roles.cache.has(config.get('GUILD_DELIMITER_ROLE_ID'))) rolesToAdd.push(config.get('GUILD_DELIMITER_ROLE_ID'));
		} else if (member.roles.cache.has(config.get('GUILD_DELIMITER_ROLE_ID'))) {
			rolesToRemove.push(config.get('GUILD_DELIMITER_ROLE_ID'));
		}

		[ config.get('GUILD_ROLE_ID'), config.get('SKILL_DELIMITER_ROLE_ID'), config.get('SLAYER_DELIMITER_ROLE_ID'), config.get('DUNGEON_DELIMITER_ROLE_ID'), config.get('MISC_DELIMITER_ROLE_ID') ]
			.forEach(roleID => !member.roles.cache.has(roleID) && rolesToAdd.push(roleID));

		[ config.get('EX_GUILD_ROLE_ID') ]
			.forEach(roleID => member.roles.cache.has(roleID) && rolesToRemove.push(roleID));

		// hypixel guild roles
		for (const [ guildID, { roleID } ] of this.client.hypixelGuilds.cache) {
			if (guildID === this.guildID) {
				if (!member.roles.cache.has(roleID)) rolesToAdd.push(roleID);
			} else if (member.roles.cache.has(roleID)) {
				rolesToRemove.push(roleID);
			}
		}

		// hypixel guild ranks
		const guildRank = this.guildRank;

		if (guildRank) {
			if (guildRank.roleID && !member.roles.cache.has(guildRank.roleID)) {
				reason = 'synced with ingame rank';
				rolesToAdd.push(guildRank.roleID);
			}

			if (guildRank.priority < 4) { // non staff rank -> remove other ranks
				for (const rank of this.guild.ranks.filter(r => r.roleID && r.priority !== this.guildRankPriority)) {
					if (member.roles.cache.has(rank.roleID)) rolesToRemove.push(rank.roleID);
				}
			}
		}

		// skills
		const skillAverage = SKILLS
			.map(skill => {
				const { progressLevel } = this.getSkillLevel(skill);

				// individual skill lvl 45+ / 50+ / 55+ / 60
				if (progressLevel >= 60) {
					if (!member.roles.cache.has(config.get(`${skill}_60_ROLE_ID`))) rolesToAdd.push(config.get(`${skill}_60_ROLE_ID`));
					if (member.roles.cache.has(config.get(`${skill}_55_ROLE_ID`))) rolesToRemove.push(config.get(`${skill}_55_ROLE_ID`));
					if (member.roles.cache.has(config.get(`${skill}_50_ROLE_ID`))) rolesToRemove.push(config.get(`${skill}_50_ROLE_ID`));
					if (member.roles.cache.has(config.get(`${skill}_45_ROLE_ID`))) rolesToRemove.push(config.get(`${skill}_45_ROLE_ID`));
				} else if (progressLevel >= 55) {
					if (member.roles.cache.has(config.get(`${skill}_60_ROLE_ID`))) rolesToRemove.push(config.get(`${skill}_60_ROLE_ID`));
					if (!member.roles.cache.has(config.get(`${skill}_55_ROLE_ID`))) rolesToAdd.push(config.get(`${skill}_55_ROLE_ID`));
					if (member.roles.cache.has(config.get(`${skill}_50_ROLE_ID`))) rolesToRemove.push(config.get(`${skill}_50_ROLE_ID`));
					if (member.roles.cache.has(config.get(`${skill}_45_ROLE_ID`))) rolesToRemove.push(config.get(`${skill}_45_ROLE_ID`));
				} else if (progressLevel >= 50) {
					if (member.roles.cache.has(config.get(`${skill}_60_ROLE_ID`))) rolesToRemove.push(config.get(`${skill}_60_ROLE_ID`));
					if (member.roles.cache.has(config.get(`${skill}_55_ROLE_ID`))) rolesToRemove.push(config.get(`${skill}_55_ROLE_ID`));
					if (!member.roles.cache.has(config.get(`${skill}_50_ROLE_ID`))) rolesToAdd.push(config.get(`${skill}_50_ROLE_ID`));
					if (member.roles.cache.has(config.get(`${skill}_45_ROLE_ID`))) rolesToRemove.push(config.get(`${skill}_45_ROLE_ID`));
				} else if (progressLevel >= 45) {
					if (member.roles.cache.has(config.get(`${skill}_60_ROLE_ID`))) rolesToRemove.push(config.get(`${skill}_60_ROLE_ID`));
					if (member.roles.cache.has(config.get(`${skill}_55_ROLE_ID`))) rolesToRemove.push(config.get(`${skill}_55_ROLE_ID`));
					if (member.roles.cache.has(config.get(`${skill}_50_ROLE_ID`))) rolesToRemove.push(config.get(`${skill}_50_ROLE_ID`));
					if (!member.roles.cache.has(config.get(`${skill}_45_ROLE_ID`))) rolesToAdd.push(config.get(`${skill}_45_ROLE_ID`));
				} else { // skill lvl < 45
					if (member.roles.cache.has(config.get(`${skill}_60_ROLE_ID`))) rolesToRemove.push(config.get(`${skill}_60_ROLE_ID`));
					if (member.roles.cache.has(config.get(`${skill}_55_ROLE_ID`))) rolesToRemove.push(config.get(`${skill}_55_ROLE_ID`));
					if (member.roles.cache.has(config.get(`${skill}_50_ROLE_ID`))) rolesToRemove.push(config.get(`${skill}_50_ROLE_ID`));
					if (member.roles.cache.has(config.get(`${skill}_45_ROLE_ID`))) rolesToRemove.push(config.get(`${skill}_45_ROLE_ID`));
				}

				return progressLevel;
			})
			.reduce((acc, level) => acc + level, 0) / SKILLS.length;

		// average skill lvl 40+ / 45+ / 50+
		if (skillAverage >= 50) {
			if (!member.roles.cache.has(config.get('AVERAGE_LVL_50_ROLE_ID'))) rolesToAdd.push(config.get('AVERAGE_LVL_50_ROLE_ID'));
			if (member.roles.cache.has(config.get('AVERAGE_LVL_45_ROLE_ID'))) rolesToRemove.push(config.get('AVERAGE_LVL_45_ROLE_ID'));
			if (member.roles.cache.has(config.get('AVERAGE_LVL_40_ROLE_ID'))) rolesToRemove.push(config.get('AVERAGE_LVL_40_ROLE_ID'));
		} else if (skillAverage >= 45) {
			if (member.roles.cache.has(config.get('AVERAGE_LVL_50_ROLE_ID'))) rolesToRemove.push(config.get('AVERAGE_LVL_50_ROLE_ID'));
			if (!member.roles.cache.has(config.get('AVERAGE_LVL_45_ROLE_ID'))) rolesToAdd.push(config.get('AVERAGE_LVL_45_ROLE_ID'));
			if (member.roles.cache.has(config.get('AVERAGE_LVL_40_ROLE_ID'))) rolesToRemove.push(config.get('AVERAGE_LVL_40_ROLE_ID'));
		} else if (skillAverage >= 40) {
			if (member.roles.cache.has(config.get('AVERAGE_LVL_50_ROLE_ID'))) rolesToRemove.push(config.get('AVERAGE_LVL_50_ROLE_ID'));
			if (member.roles.cache.has(config.get('AVERAGE_LVL_45_ROLE_ID'))) rolesToRemove.push(config.get('AVERAGE_LVL_45_ROLE_ID'));
			if (!member.roles.cache.has(config.get('AVERAGE_LVL_40_ROLE_ID'))) rolesToAdd.push(config.get('AVERAGE_LVL_40_ROLE_ID'));
		} else { // skill average < 40
			if (member.roles.cache.has(config.get('AVERAGE_LVL_50_ROLE_ID'))) rolesToRemove.push(config.get('AVERAGE_LVL_50_ROLE_ID'));
			if (member.roles.cache.has(config.get('AVERAGE_LVL_45_ROLE_ID'))) rolesToRemove.push(config.get('AVERAGE_LVL_45_ROLE_ID'));
			if (member.roles.cache.has(config.get('AVERAGE_LVL_40_ROLE_ID'))) rolesToRemove.push(config.get('AVERAGE_LVL_40_ROLE_ID'));
		}

		// slayers
		const LOWEST_SLAYER_LVL = Math.min(...SLAYERS.map(slayer => {
			const SLAYER_LVL = this.getSlayerLevel(slayer);

			// individual slayer 8 / 9
			if (SLAYER_LVL >= 9) {
				if (!member.roles.cache.has(config.get(`${slayer}_9_ROLE_ID`))) rolesToAdd.push(config.get(`${slayer}_9_ROLE_ID`));
				if (member.roles.cache.has(config.get(`${slayer}_8_ROLE_ID`))) rolesToRemove.push(config.get(`${slayer}_8_ROLE_ID`));
			} else if (SLAYER_LVL >= 8) {
				if (member.roles.cache.has(config.get(`${slayer}_9_ROLE_ID`))) rolesToRemove.push(config.get(`${slayer}_9_ROLE_ID`));
				if (!member.roles.cache.has(config.get(`${slayer}_8_ROLE_ID`))) rolesToAdd.push(config.get(`${slayer}_8_ROLE_ID`));
			} else { // slayer lvl < 8
				if (member.roles.cache.has(config.get(`${slayer}_9_ROLE_ID`))) rolesToRemove.push(config.get(`${slayer}_9_ROLE_ID`));
				if (member.roles.cache.has(config.get(`${slayer}_8_ROLE_ID`))) rolesToRemove.push(config.get(`${slayer}_8_ROLE_ID`));
			}

			return SLAYER_LVL;
		}));

		// slayer 999 / 888 / 777
		if (LOWEST_SLAYER_LVL >= 9) {
			if (!member.roles.cache.has(config.get('SLAYER_999_ROLE_ID'))) rolesToAdd.push(config.get('SLAYER_999_ROLE_ID'));
			if (member.roles.cache.has(config.get('SLAYER_888_ROLE_ID'))) rolesToRemove.push(config.get('SLAYER_888_ROLE_ID'));
			if (member.roles.cache.has(config.get('SLAYER_777_ROLE_ID'))) rolesToRemove.push(config.get('SLAYER_777_ROLE_ID'));
		} else if (LOWEST_SLAYER_LVL >= 8) {
			if (member.roles.cache.has(config.get('SLAYER_999_ROLE_ID'))) rolesToRemove.push(config.get('SLAYER_999_ROLE_ID'));
			if (!member.roles.cache.has(config.get('SLAYER_888_ROLE_ID'))) rolesToAdd.push(config.get('SLAYER_888_ROLE_ID'));
			if (member.roles.cache.has(config.get('SLAYER_777_ROLE_ID'))) rolesToRemove.push(config.get('SLAYER_777_ROLE_ID'));
		} else if (LOWEST_SLAYER_LVL >= 7) {
			if (member.roles.cache.has(config.get('SLAYER_999_ROLE_ID'))) rolesToRemove.push(config.get('SLAYER_999_ROLE_ID'));
			if (member.roles.cache.has(config.get('SLAYER_888_ROLE_ID'))) rolesToRemove.push(config.get('SLAYER_888_ROLE_ID'));
			if (!member.roles.cache.has(config.get('SLAYER_777_ROLE_ID'))) rolesToAdd.push(config.get('SLAYER_777_ROLE_ID'));
		} else { // slayer < 777
			if (member.roles.cache.has(config.get('SLAYER_999_ROLE_ID'))) rolesToRemove.push(config.get('SLAYER_999_ROLE_ID'));
			if (member.roles.cache.has(config.get('SLAYER_888_ROLE_ID'))) rolesToRemove.push(config.get('SLAYER_888_ROLE_ID'));
			if (member.roles.cache.has(config.get('SLAYER_777_ROLE_ID'))) rolesToRemove.push(config.get('SLAYER_777_ROLE_ID'));
		}

		// dungeons
		const { trueLevel: CATACOMBS_LVL } = this.getSkillLevel('catacombs');

		if (CATACOMBS_LVL >= 35) {
			if (!member.roles.cache.has(config.get('CATACOMBS_35_ROLE_ID'))) rolesToAdd.push(config.get('CATACOMBS_35_ROLE_ID'));
			if (member.roles.cache.has(config.get('CATACOMBS_30_ROLE_ID'))) rolesToRemove.push(config.get('CATACOMBS_30_ROLE_ID'));
			if (member.roles.cache.has(config.get('CATACOMBS_25_ROLE_ID'))) rolesToRemove.push(config.get('CATACOMBS_25_ROLE_ID'));
			if (member.roles.cache.has(config.get('CATACOMBS_20_ROLE_ID'))) rolesToRemove.push(config.get('CATACOMBS_20_ROLE_ID'));
		} else if (CATACOMBS_LVL >= 30) {
			if (member.roles.cache.has(config.get('CATACOMBS_35_ROLE_ID'))) rolesToRemove.push(config.get('CATACOMBS_35_ROLE_ID'));
			if (!member.roles.cache.has(config.get('CATACOMBS_30_ROLE_ID'))) rolesToAdd.push(config.get('CATACOMBS_30_ROLE_ID'));
			if (member.roles.cache.has(config.get('CATACOMBS_25_ROLE_ID'))) rolesToRemove.push(config.get('CATACOMBS_25_ROLE_ID'));
			if (member.roles.cache.has(config.get('CATACOMBS_20_ROLE_ID'))) rolesToRemove.push(config.get('CATACOMBS_20_ROLE_ID'));
		} else if (CATACOMBS_LVL >= 25) {
			if (member.roles.cache.has(config.get('CATACOMBS_35_ROLE_ID'))) rolesToRemove.push(config.get('CATACOMBS_35_ROLE_ID'));
			if (member.roles.cache.has(config.get('CATACOMBS_30_ROLE_ID'))) rolesToRemove.push(config.get('CATACOMBS_30_ROLE_ID'));
			if (!member.roles.cache.has(config.get('CATACOMBS_25_ROLE_ID'))) rolesToAdd.push(config.get('CATACOMBS_25_ROLE_ID'));
			if (member.roles.cache.has(config.get('CATACOMBS_20_ROLE_ID'))) rolesToRemove.push(config.get('CATACOMBS_20_ROLE_ID'));
		} else if (CATACOMBS_LVL >= 20) {
			if (member.roles.cache.has(config.get('CATACOMBS_35_ROLE_ID'))) rolesToRemove.push(config.get('CATACOMBS_35_ROLE_ID'));
			if (member.roles.cache.has(config.get('CATACOMBS_30_ROLE_ID'))) rolesToRemove.push(config.get('CATACOMBS_30_ROLE_ID'));
			if (member.roles.cache.has(config.get('CATACOMBS_25_ROLE_ID'))) rolesToRemove.push(config.get('CATACOMBS_25_ROLE_ID'));
			if (!member.roles.cache.has(config.get('CATACOMBS_20_ROLE_ID'))) rolesToAdd.push(config.get('CATACOMBS_20_ROLE_ID'));
		} else { // cata lvl < 20
			if (member.roles.cache.has(config.get('CATACOMBS_35_ROLE_ID'))) rolesToRemove.push(config.get('CATACOMBS_35_ROLE_ID'));
			if (member.roles.cache.has(config.get('CATACOMBS_30_ROLE_ID'))) rolesToRemove.push(config.get('CATACOMBS_30_ROLE_ID'));
			if (member.roles.cache.has(config.get('CATACOMBS_25_ROLE_ID'))) rolesToRemove.push(config.get('CATACOMBS_25_ROLE_ID'));
			if (member.roles.cache.has(config.get('CATACOMBS_20_ROLE_ID'))) rolesToRemove.push(config.get('CATACOMBS_20_ROLE_ID'));
		}

		return this.makeRoleApiCall(rolesToAdd, rolesToRemove, reason);
	}

	/**
	 * tries to link unlinked players via discord.js-cache (without any discord API calls)
	 * @returns {Promise<?LunarGuildMember>}
	 */
	async linkUsingCache() {
		const lgGuild = this.client.lgGuild;

		if (!lgGuild) return null;

		let member;

		if (this.discordID) { // tag or ID known
			member = /\D/.test(this.discordID)
				? lgGuild.members.cache.find(m => m.user.tag === this.discordID) // tag known
				: lgGuild.members.cache.get(this.discordID); // id known

			if (!member) {
				const DISCORD_TAG = await this.fetchDiscordTag();

				if (!DISCORD_TAG) return null;

				member = lgGuild.members.cache.find(m => m.user.tag === DISCORD_TAG);
			}
		} else { // unknown tag
			const DISCORD_TAG = await this.fetchDiscordTag();

			if (!DISCORD_TAG) return null;

			member = lgGuild.members.cache.find(m => m.user.tag === DISCORD_TAG);
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

			if (reason) await this.update({
				shouldSkipQueue: true,
				reason,
			});
		} else if (typeof idOrDiscordMember === 'string' && /\D/.test(idOrDiscordMember)) {
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
			const rolesToPurge = currentLinkedMember.rolesToPurge;

			if (rolesToPurge.length)
				wasSuccessful = await this.makeRoleApiCall([], rolesToPurge, reason);

			// reset nickname if it is set to the player's ign
			if (currentLinkedMember.nickname === this.ign)
				wasSuccessful = (await this.makeNickApiCall(null, false, reason)) && wasSuccessful;
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
		rolesToAdd = rolesToAdd.filter(x => x != null);
		rolesToRemove = rolesToRemove.filter(x => x != null);
		if (!rolesToAdd.length && !rolesToRemove.length) return;

		// permission check
		if (!member.guild.me.hasPermission('MANAGE_ROLES')) return logger.warn(`[ROLE API CALL]: missing 'MANAGE_ROLES' in '${member.guild.name}'`);

		const { config } = member.client;
		const IS_ADDING_GUILD_ROLE = rolesToAdd.includes(config.get('GUILD_ROLE_ID'));

		// check if IDs are proper roles and managable by the bot
		rolesToAdd = member.guild.verifyRoleIDs(rolesToAdd);
		rolesToRemove = member.guild.verifyRoleIDs(rolesToRemove);
		if (!rolesToAdd.size && !rolesToRemove.size) return;

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
			this.discordMember = await member.roles.set(member.roles.cache.filter((_, roleID) => !rolesToRemove.has(roleID)).concat(rolesToAdd), reason);

			// was successful
			loggingEmbed.setColor(IS_ADDING_GUILD_ROLE ? config.get('EMBED_GREEN') : config.get('EMBED_BLUE'));
			if (rolesToAdd.size) loggingEmbed.addField('Added', `\`\`\`\n${rolesToAdd.map(role => role.name).join('\n')}\`\`\``, true);
			if (rolesToRemove.size) loggingEmbed.addField('Removed', `\`\`\`\n${rolesToRemove.map(role => role.name).join('\n')}\`\`\``, true);
			return true;
		} catch (error) {
			// was not successful
			this.discordMember = null;
			logger.error(`[ROLE API CALL]: ${error.name}: ${error.message}`);
			loggingEmbed
				.setColor(config.get('EMBED_RED'))
				.addField(error.name, error.message);
			if (rolesToAdd.size) loggingEmbed.addField('Failed to add', `\`\`\`\n${rolesToAdd.map(role => role.name).join('\n')}\`\`\``, true);
			if (rolesToRemove.size) loggingEmbed.addField('Failed to remove', `\`\`\`\n${rolesToRemove.map(role => role.name).join('\n')}\`\`\``, true);
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
		} else {
			logger.info(`[REMOVE FROM GUILD]: ${this.logInfo}: left without being in the discord`);
		}

		this.guildID = null;
		this.guildRankPriority = 0;
		this.save();
		this.client.players.delete(this);
		return true;
	}

	/**
	 * check if the discord member's display name includes the player ign and tries to change it if it doesn't
	 * @param {boolean} shouldSendDm wether to dm the user that they should include their ign somewhere in their nickname
	 */
	async syncIgnWithDisplayName(shouldSendDm = false) {
		if (this.guildID === GUILD_ID_BRIDGER) return;

		const member = await this.discordMember;

		if (!member) return;
		if (member.displayName.toLowerCase().includes(this.ign.toLowerCase())) return; // nickname includes ign
		if (this.ign === UNKNOWN_IGN) return; // mojang api error

		return this.makeNickApiCall(this.ign, shouldSendDm, 'display name didn\'t contain ign');
	}

	/**
	 * sets a nickname for the player's discord member
	 * @param {?string} newNick new nickname, null to remove the current nickname
	 * @param {boolean} shouldSendDm wether to dm the user that they should include their ign somewhere in their nickname
	 * @param {?string} reason reason for discord's audit logs
	 * @returns {Promise<boolean>} wether the API call was successful
	 */
	async makeNickApiCall(newNick = null, shouldSendDm = false, reason = null) {
		const member = await this.discordMember;

		if (!member) return;
		if (member.guild.me.roles.highest.comparePositionTo(member.roles.highest) < 1) return; // member's highest role is above bot's highest role
		if (member.guild.ownerID === member.id) return; // can't change nick of owner
		if (!member.guild.me.hasPermission('MANAGE_NICKNAMES')) return logger.warn(`[SYNC IGN DISPLAYNAME]: ${this.logInfo}: missing 'MANAGE_NICKNAMES' permission`);

		const { displayName: PREV_NAME } = member;

		try {
			this.discordMember = await member.setNickname(newNick, reason);

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
					.send(stripIndents`
						include your ign \`${newNick}\` somewhere in your nickname.
						If you just changed your ign, wait up to ${this.client.config.get('DATABASE_UPDATE_INTERVAL')} minutes and ${this.client.user} will automatically change your discord nickname
					`)
					.then(
						() => logger.info(`[SYNC IGN DISPLAYNAME]: ${this.logInfo}: sent nickname info DM`),
						error => logger.error(`[SYNC IGN DISPLAYNAME]: ${this.logInfo}: unable to DM: ${error.name}: ${error.message}`),
					);
			}

			return true;
		} catch (error) {
			logger.error(`[SYNC IGN DISPLAYNAME]: ${this.logInfo}: ${error.name}: ${error.message}`);
			this.discordMember = null;
			return false;
		}
	}

	/**
	 * fetches the discord tag from hypixel
	 * @param {boolean} shouldSkipQueue wether to use the hypixel aux client when the main one's request queue is filled
	 */
	async fetchDiscordTag(shouldSkipQueue = false) {
		return (await getHypixelClient(shouldSkipQueue).player.uuid(this.minecraftUUID).catch(error => logger.error(`[FETCH DISCORD TAG]: ${this.logInfo}: ${error.name}${error.code ? ` ${error.code}` : ''}: ${error.message}`)))?.socialMedia?.links?.DISCORD ?? null;
	}

	/**
	 * determines the player's main profile (profile with the most progress)
	 * @param {boolean} shouldSkipQueue wether to use the hypixel aux client when the main one's request queue is filled
	 */
	async fetchMainProfile(shouldSkipQueue = false) {
		const profiles = await getHypixelClient(shouldSkipQueue).skyblock.profiles.uuid(this.minecraftUUID);

		if (!profiles.length) throw new Error(`[MAIN PROFILE]: ${this.logInfo}: unable to detect main profile name`);

		const mainProfile = profiles[
			profiles.length > 1
				? profiles
					.map(profile => {
						const member = profile.members[this.minecraftUUID];
						// calculate weight of this profile
						return Math.max(...SKILLS.map(skill => member[`experience_skill_${skill}`] ?? 0)) / 100 // highest skill xp / 100
							+ SLAYERS.reduce((acc, slayer) => acc + (member.slayer_bosses?.[slayer]?.xp ?? 0), 0); // total slayer xp
					})
					.reduce((bestIndexSoFar, currentlyTestedValue, currentlyTestedIndex, array) => currentlyTestedValue > array[bestIndexSoFar] ? currentlyTestedIndex : bestIndexSoFar, 0)
				: 0
		];

		this.mainProfileID = mainProfile.profile_id;
		this.mainProfileName = mainProfile.cute_name;

		logger.info(`[MAIN PROFILE]: ${this.logInfo} -> ${this.mainProfileName}`);
	}

	/**
	 * updates the player's IGN via the mojang API
	 * @returns {Promise<object?>} { oldIgn, newIgn }
	 */
	async updateIgn() {
		const PLAYER_IGN_CURRENT = await mojang.getName(this.minecraftUUID).catch(error => logger.error(`[UPDATE IGN]: ${this.logInfo}: ${error.name}: ${error.message}`));

		if (!PLAYER_IGN_CURRENT || PLAYER_IGN_CURRENT === this.ign) return null;

		const { ign } = this;

		this.ign = PLAYER_IGN_CURRENT;
		await this.save();

		this.syncIgnWithDisplayName();

		return {
			oldIgn: ign,
			newIgn: PLAYER_IGN_CURRENT,
		};
	}

	/**
	 * transfers xp offsets
	 * @param {obejct} options
	 * @param {string} options.from
	 * @param {string} options.to
	 * @param {?string[]} [options.types]
	 */
	async transferXp({ from, to, types }) {
		types ??= XP_TYPES;

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
				return this.resetXp({ offsetToReset: 'day', typesToReset });

			case 'day':
				// append current xp to the beginning of the xpHistory-Array and pop of the last value
				typesToReset.forEach(type => {
					const xpHistory = this[`${type}XpHistory`];
					xpHistory.pop();
					xpHistory.unshift(this[`${type}Xp`]);
					this.changed(`${type}XpHistory`, true); // neccessary so that sequelize knows an array has changed and the db needs to be updated
				});
				break;

			case 'current':
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
			order: [[ 'createdAt', 'DESC' ]],
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
	 * @param {object} data from the hypixel guild API
	 * @param {object} data.expHistory member.expHistory
	 * @param {?number} data.mutedTill member.mutedTill
	 */
	async syncWithGuildData({ expHistory = {}, mutedTill } = {}) {
		// update guild xp
		const currentDay = Object.keys(expHistory)[0];

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
		} else {
			this.client.config.getBoolean('EXTENDED_LOGGING') && logger.warn(`[UPDATE GUILD XP]: ${this.logInfo}: no guild xp found`);
		}

		// sync guild mutes
		if (mutedTill) {
			this.chatBridgeMutedUntil = mutedTill;
		}

		return this.save();
	}

	/**
	 * returns the true and progression level for the provided skill type
	 * @param {string} type the skill or dungeon type
	 * @param {string} offset optional offset value to use instead of the current xp value
	 */
	getSkillLevel(type, offset = '') {
		const xp = this[`${type}Xp${offset}`];

		let xpTable = [ ...DUNGEON_CLASSES, ...DUNGEON_TYPES ].includes(type) ? DUNGEON_XP : type === 'runecrafting' ? RUNECRAFTING_XP : LEVELING_XP;
		let maxLevel = Math.max(...Object.keys(xpTable));
		let maxLevelCap = maxLevel;

		if (Object.hasOwnProperty.call(SKILLS_CAP, type) && SKILLS_CAP[type] > maxLevel) {
			xpTable = { ...SKILL_XP_PAST_50, ...xpTable };
			maxLevel = Math.max(...Object.keys(xpTable));
			maxLevelCap = Object.hasOwnProperty.call(this, `${type}LvlCap`) ? this[`${type}LvlCap`] : maxLevel;
		}

		let xpTotal = 0;
		let trueLevel = 0;

		for (let x = 1; x <= maxLevelCap; ++x) {
			xpTotal += xpTable[x];

			if (xpTotal > xp) {
				xpTotal -= xpTable[x];
				break;
			} else {
				trueLevel = x;
			}
		}

		if (trueLevel < maxLevel) {
			const nonFlooredLevel = trueLevel + Math.floor(xp - xpTotal) / xpTable[trueLevel + 1];

			return {
				trueLevel,
				progressLevel: Math.floor(nonFlooredLevel * 100) / 100,
				nonFlooredLevel,
			};
		}

		return {
			trueLevel,
			progressLevel: trueLevel,
			nonFlooredLevel: trueLevel,
		};
	}

	/**
	 * returns the true and progression skill average
	 * @param {string} offset optional offset value to use instead of the current xp value
	 */
	getSkillAverage(offset = '') {
		const SKILL_COUNT = SKILLS.length;

		let skillAverage = 0;
		let trueAverage = 0;

		SKILLS.forEach(skill => {
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
		const maxLevel = Math.max(...Object.keys(SLAYER_XP));

		let level = 0;

		for (let x = 1; x <= maxLevel && SLAYER_XP[x] <= xp; ++x) {
			level = x;
		}

		return level;
	}

	/**
	 * returns the total slayer xp
	 * @param {string} offset optional offset value to use instead of the current xp value
	 */
	getSlayerTotal(offset = '') {
		return SLAYERS.reduce((acc, slayer) => acc + this[`${slayer}Xp${offset}`], 0);
	}

	/**
	 * calculates the player's weight using Senither's formula
	 * @param {string} offset optional offset value to use instead of the current xp value
	 */
	getWeight(offset = '') {
		let weight = 0;
		let overflow = 0;

		for (const skill of SKILLS) {
			const { nonFlooredLevel: level } = this.getSkillLevel(skill, offset);
			const xp = this[`${skill}Xp${offset}`];

			let maxXp = Object.values(LEVELING_XP).reduce((acc, currentXp) => acc + currentXp, 0);

			if (SKILLS_CAP[skill] > 50) maxXp += Object.values(SKILL_XP_PAST_50).reduce((acc, currentXp) => acc + currentXp, 0);

			weight += Math.pow(level * 10, 0.5 + SKILL_EXPONENTS[skill] + (level / 100)) / 1250;
			if (xp > maxXp) overflow += Math.pow((xp - maxXp) / SKILL_DIVIDER[skill], 0.968);
		}

		for (const slayer of SLAYERS) {
			const experience = this[`${slayer}Xp${offset}`];

			weight += experience <= 1_000_000
				? experience / SLAYER_DIVIDER[slayer]
				: 1_000_000 / SLAYER_DIVIDER[slayer] + Math.pow((experience - 1_000_000) / (SLAYER_DIVIDER[slayer] * 1.5), 0.942);
		}

		const maxXp = Object.values(DUNGEON_XP).reduce((acc, xp) => acc + xp, 0);

		for (const type of [ ...DUNGEON_TYPES, ...DUNGEON_CLASSES ]) {
			const { nonFlooredLevel: level } = this.getSkillLevel(type, offset);
			const base = Math.pow(level, 4.5) * DUNGEON_EXPONENTS[type];
			const xp = this[`${type}Xp${offset}`];

			weight += base;
			if (xp > maxXp) overflow += Math.pow((xp - maxXp) / (4 * maxXp / base), 0.968);
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
