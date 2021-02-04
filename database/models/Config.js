'use strict';

const { Model } = require('sequelize');


module.exports = (sequelize, DataTypes) => {
	class Config extends Model {
		/**
		 * Helper method for defining associations.
		 * This method is not a part of Sequelize lifecycle.
		 * The `models/index` file will call this method automatically.
		 */
		static associate(models) {
			// define associations here
		}
	}

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
