'use strict';

const { Model } = require('sequelize');


class TaxCollector extends Model {
	constructor(...args) {
		super(...args);

		/**
		 * @type {import('../../LunarClient')}
		 */
		this.client;
		/**
		 * @type {string}
		 */
		this.minecraftUUID;
		/**
		 * @type {string}
		 */
		this.ign;
		/**
		 * @type {boolean}
		 */
		this.isCollecting;
		/**
		 * @type {number}
		 */
		this.collectedAmount;
	}

	/**
	 * Helper method for defining associations.
	 * This method is not a part of Sequelize lifecycle.
	 * The `models/index` file will call this method automatically.
	 */
	static associate(models) {
		// define associations here
	}

	get player() {
		return this.client.players.cache.get(this.minecraftUUID) ?? null;
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
		return this.client.taxCollectors.remove(this);
	}

	// todo
	async update() {
		return 'WIP';
	}
}

module.exports = TaxCollector;
