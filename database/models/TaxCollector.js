'use strict';

const TaxCollector = require('../../src/structures/TaxCollector');


module.exports = (sequelize, DataTypes) => {

	TaxCollector.init({
		minecraftUUID: {
			type: DataTypes.STRING,
			primaryKey: true,
		},
		ign: {
			type: DataTypes.STRING,
			defaultValue: null,
			allowNull: true,
		},
		isCollecting: {
			type: DataTypes.BOOLEAN,
			defaultValue: true,
			allowNull: false,
		},
		collectedAmount: {
			type: DataTypes.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
	}, {
		sequelize,
		modelName: 'TaxCollector',
	});

	return TaxCollector;
};
