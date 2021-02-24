'use strict';

const TaxCollector = require('../../src/structures/database/models/TaxCollector');


/**
 * @param {import('sequelize')} sequelize
 * @param {import('sequelize').DataTypes} DataTypes
 */
module.exports = (sequelize, DataTypes) => {

	TaxCollector.init({
		minecraftUUID: {
			type: DataTypes.STRING,
			primaryKey: true,
		},
		isCollecting: {
			type: DataTypes.BOOLEAN,
			defaultValue: true,
			allowNull: false,
		},
		collectedTax: {
			type: DataTypes.BIGINT,
			defaultValue: 0,
			allowNull: false,
		},
		collectedDonations: {
			type: DataTypes.BIGINT,
			defaultValue: 0,
			allowNull: false,
		},
	}, {
		sequelize,
		modelName: 'TaxCollector',
	});

	return TaxCollector;
};
