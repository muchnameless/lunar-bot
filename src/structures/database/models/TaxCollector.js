'use strict';

const { Model, DataTypes } = require('sequelize');


module.exports = class TaxCollector extends Model {
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
		 * @type {boolean}
		 */
		this.isCollecting;
		/**
		 * @type {number}
		 */
		this.collectedTax;
		/**
		 * @type {number}
		 */
		this.collectedDonations;
	}

	/**
	 * @param {import('sequelize')} sequelize
	 */
	static init(sequelize) {
		return super.init({
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
	}

	get player() {
		return this.client.players.cache.get(this.minecraftUUID) ?? null;
	}

	get ign() {
		return this.player?.ign ?? null;
	}

	/**
	 * adds the amount to the taxCollector's collected amount
	 * @param {number} amount
	 * @param {string} type
	 */
	async addAmount(amount, type = 'tax') {
		switch (type) {
			case 'tax':
				this.collectedTax += amount;
				return this.save();

			case 'donation':
				this.collectedDonations += amount;
				return this.save();

			default:
				throw new Error(`[ADD AMOUNT]: ${this.ign ?? this.minecraftUUID}: unknown type '${type}'`);
		}
	}

	/**
	 * resets the specified amount back to 0
	 * @param {string} type
	 */
	async resetAmount(type = 'tax') {
		switch (type) {
			case 'tax':
			case 'taxes':
				this.collectedTax = 0;
				return this.save();

			case 'donation':
			case 'donations':
				this.collectedDonations = 0;
				return this.save();

			default:
				throw new Error(`[RESET AMOUNT]: ${this.ign ?? this.minecraftUUID}: unknown type '${type}'`);
		}
	}

	/**
	 * removes the collector from the database
	 */
	async remove() {
		return this.client.taxCollectors.remove(this);
	}
};
