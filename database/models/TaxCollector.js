'use strict';

const { Model } = require('sequelize');


module.exports = (sequelize, DataTypes) => {
	class TaxCollector extends Model {
		/**
		 * Helper method for defining associations.
		 * This method is not a part of Sequelize lifecycle.
		 * The `models/index` file will call this method automatically.
		 */
		static associate(models) {
			// define associations here
		}

		get player() {
			return this.client.players.get(this.minecraftUUID) ?? null;
		}

		async addAmount(amount) {
			this.collectedAmount += amount;
			return this.save();
		}

		async resetAmount() {
			this.collectedAmount = this.client.config.getNumber('TAX_AMOUNT');
			return this.save();
		}

		async remove() {
			this.client.taxCollectors.delete(this.minecraftUUID);
			return this.destroy();
		}

		//todo
		async update() {
			return 'WIP';
		}
	}

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
