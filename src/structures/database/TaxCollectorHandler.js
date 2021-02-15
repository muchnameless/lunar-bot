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

	async add(player) {
		return super.add({
			minecraftUUID: player.minecraftUUID,
			ign: player.ign,
			isCollecting: true,
			collectedAmount: 0,
		});
	}

	getByID(id) {
		return this.cache.get(this.client.players.getByID(id)?.minecraftUUID) ?? null;
	}

	getByIGN(ign) {
		return this.cache.get(this.client.players.getByIGN(ign)?.minecraftUUID) ?? null;
	}
}

module.exports = TaxCollectorHandler;
