'use strict';

const { Model, DataTypes } = require('sequelize');


module.exports = class Config extends Model {
	constructor(...args) {
		super(...args);

		/**
		 * @type {import('../../LunarClient')}
		 */
		this.client;
		/**
		 * @type {string}
		 */
		this.key;
		/**
		 * @type {string}
		 */
		this.value;
	}

	/**
	 * @param {import('sequelize')} sequelize
	 */
	static init(sequelize) {
		return super.init({
			key: {
				type: DataTypes.STRING,
				primaryKey: true,
			},
			value: {
				type: DataTypes.STRING,
				allowNull: true,
			},
		}, {
			sequelize,
			modelName: 'Config',
			timestamps: false,
			freezeTableName: true,
		});
	}
};
