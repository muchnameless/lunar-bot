'use strict';

const { Model } = require('sequelize');


module.exports = (sequelize, DataTypes) => {
	class CronJob extends Model {
		/**
		 * Helper method for defining associations.
		 * This method is not a part of Sequelize lifecycle.
		 * The `models/index` file will call this method automatically.
		 */
		static associate(models) {
			// define associations here
		}
	}

	CronJob.init({
		name: {
			type: DataTypes.TEXT,
			primaryKey: true,
		},
		date: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		command: {
			type: DataTypes.TEXT,
			allowNull: false,
		},
		authorID: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		messageID: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		channelID: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		args: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
		flags: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
	}, {
		sequelize,
		modelName: 'CronJob',
		timestamps: false,
	});

	return CronJob;
};
