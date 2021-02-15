'use strict';

const Item = require('../../src/structures/database/models/Item');


module.exports = (sequelize, DataTypes) => {

	Item.init({
		name: {
			type: DataTypes.STRING,
			primaryKey: true,
		},
		lowestBin: {
			type: DataTypes.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
	}, {
		sequelize,
		modelName: 'Item',
		timestamps: false,
	});

	return Item;
};
