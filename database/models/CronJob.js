'use strict';

const CronJob = require('../../src/structures/database/models/CronJob');


module.exports = (sequelize, DataTypes) => {

	CronJob.init({
		name: {
			type: DataTypes.TEXT,
			primaryKey: true,
		},
		date: {
			type: DataTypes.BIGINT,
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
