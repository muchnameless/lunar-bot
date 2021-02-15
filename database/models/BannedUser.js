'use strict';

const BannedUser = require('../../src/structures/database/models/BannedUser');


/**
 * @param {import('sequelize')} sequelize
 * @param {import('sequelize').DataTypes} DataTypes
 */
module.exports = (sequelize, DataTypes) => {

	BannedUser.init({
		discordID: {
			type: DataTypes.STRING,
			primaryKey: true,
		},
		discordTag: {
			type: DataTypes.STRING,
			defaultValue: null,
			allowNull: true,
		},
		reason: {
			type: DataTypes.TEXT,
			defaultValue: null,
			allowNull: true,
		},
		expiresAt: {
			type: DataTypes.REAL,
			defaultValue: 'Infinity',
			allowNull: false,
		},
	}, {
		sequelize,
		modelName: 'BannedUser',
		timestamps: false,
	});

	return BannedUser;
};
