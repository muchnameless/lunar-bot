'use strict';

const { Model, DataTypes } = require('sequelize');


module.exports = class Transaction extends Model {
	constructor(...args) {
		super(...args);

		/**
		 * @type {import('../../LunarClient')}
		 */
		this.client;
	}

	/**
	 * @param {import('sequelize')} sequelize
	 */
	static init(sequelize) {
		return super.init({
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
				defaultValue: null,
				allowNull: true,
			},
			notes: {
				type: DataTypes.TEXT,
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
	}
};
