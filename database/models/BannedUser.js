'use strict';

const { Model } = require('sequelize');


module.exports = (sequelize, DataTypes) => {
	class BannedUser extends Model {
		/**
		 * Helper method for defining associations.
		 * This method is not a part of Sequelize lifecycle.
		 * The `models/index` file will call this method automatically.
		 */
		static associate(models) {
			// define associations here
		}
	}

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
