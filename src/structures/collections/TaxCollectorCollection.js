'use strict';

const { TaxCollector } = require('../../../database/models/index');
const BaseClientCollection = require('./BaseClientCollection');


class TaxCollectorCollection extends BaseClientCollection {
	constructor(client, entries = null) {
		super(client, entries);
	}

	async add(player) {
		const newTaxCollector = await TaxCollector.create({
			minecraftUUID: player.minecraftUUID,
			ign: player.ign,
			isCollecting: true,
			collectedAmount: 0,
		});

		this.set(newTaxCollector.minecraftUUID, newTaxCollector);

		return newTaxCollector;
	}

	getByID(id) {
		return this.get(this.client.players.getByID(id)?.minecraftUUID) ?? null;
	}

	getByIGN(ign) {
		return this.get(this.client.players.getByIGN(ign)?.minecraftUUID) ?? null;
	}
}

module.exports = TaxCollectorCollection;
