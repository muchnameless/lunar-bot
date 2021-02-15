'use strict';

const ModelHandler = require('./ModelHandler');
const logger = require('../../functions/logger');


class TaxCollectorHandler extends ModelHandler {
	constructor(options) {
		super(options);

		/**
		 * @type {import('discord.js').Collection<string, import('./models/TaxCollector')}
		 */
		this.cache;
		/**
		 * @type {import('./models/TaxCollector')}
		 */
		this.model;
	}

	/**
	 * returns a collection of all currently active collectors
	 */
	get activeCollectors() {
		return this.cache.filter(taxCollector => taxCollector.isCollecting);
	}

	/**
	 * add a player as a taxcollector
	 * @param {string|import('./models/Player')} uuidOrPlayer
	 */
	async add(uuidOrPlayer) {
		const player = this.client.players.resolve(uuidOrPlayer);

		if (!player) throw new Error(`[TAX COLLECTOR ADD]: invalid input: ${uuidOrPlayer}`);

		return super.add({
			minecraftUUID: player.minecraftUUID,
			ign: player.ign,
			isCollecting: true,
			collectedAmount: 0,
		});
	}

	/**
	 * get a taxCollector by their discord ID
	 * @param {string} id
	 */
	getByID(id) {
		return this.cache.get(this.client.players.getByID(id)?.minecraftUUID) ?? null;
	}

	/**
	 * get a taxCollector by their IGN, case insensitive and with auto-correction
	 * @param {string} ign
	 */
	getByIGN(ign) {
		return this.cache.get(this.client.players.getByIGN(ign)?.minecraftUUID) ?? null;
	}
}

module.exports = TaxCollectorHandler;
