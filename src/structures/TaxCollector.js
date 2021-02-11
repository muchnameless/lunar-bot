'use strict';

const { Model } = require('sequelize');


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

module.exports = TaxCollector;
