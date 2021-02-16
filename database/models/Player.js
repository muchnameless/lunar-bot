'use strict';

const { XP_TYPES, XP_OFFSETS } = require('../../src/constants/database');
const Player = require('../../src/structures/database/models/Player');


/**
 * @param {import('sequelize')} sequelize
 * @param {import('sequelize').DataTypes} DataTypes
 */
module.exports = (sequelize, DataTypes) => {

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
			unique: true, // 'unique: true' breaks 'node dbInit.js --alter'
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

		// tax stats
		paid: {
			type: DataTypes.BOOLEAN,
			defaultValue: false,
			allowNull: false,
		},
		amount: {
			type: DataTypes.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
		collectedBy: { // uuid of tax collector
			type: DataTypes.STRING,
			defaultValue: null,
			allowNull: true,
		},
		auctionID: { // hypixel api auction uuid
			type: DataTypes.ARRAY(DataTypes.STRING),
			// unique: true, // 'unique: true' breaks 'node dbInit.js --alter'
			defaultValue: null,
			allowNull: true,
		},
		notes: {
			type: DataTypes.TEXT,
			defaultValue: null,
			allowNull: true,
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

	Player.init(dataObject, {
		sequelize,
		modelName: 'Player',
	});

	return Player;
};
