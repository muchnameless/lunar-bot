'use strict';

const Transaction = require('../../src/structures/database/models/Transaction');


/**
 * @param {import('sequelize')} sequelize
 * @param {import('sequelize').DataTypes} DataTypes
 */
module.exports = (sequelize, DataTypes) => {

	Transaction.init({
		from: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		to: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		amount: {
			type: DataTypes.BIGINT,
			defaultValue: 0,
			allowNull: false,
		},
		auctionID: { // hypixel api auction uuid
			type: DataTypes.STRING,
			unique: true, // 'unique: true' breaks 'node dbInit.js --alter'
			defaultValue: null,
			allowNull: true,
		},
		type: {
			type: DataTypes.ENUM([ 'tax', 'donation' ]),
			defaultValue: 'tax',
			allowNull: false,
		},
	}, {
		sequelize,
		modelName: 'Transaction',
	});

	return Transaction;
};
