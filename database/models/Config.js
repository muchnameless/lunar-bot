'use strict';

const Config = require('../../src/structures/database/models/Config');


/**
 * @param {import('sequelize')} sequelize
 * @param {import('sequelize').DataTypes} DataTypes
 */
module.exports = (sequelize, DataTypes) => {

	Config.init({
		key: {
			type: DataTypes.STRING,
			primaryKey: true,
		},
		value: {
			type: DataTypes.STRING,
			allowNull: false,
		},
	}, {
		sequelize,
		modelName: 'Config',
		timestamps: false,
		freezeTableName: true,
	});

	return Config;
};
