'use strict';

const { stripIndents } = require('common-tags');
const { MessageEmbed } = require('discord.js');
const { escapeIgn } = require('../../../functions/util');
const ModelManager = require('./ModelManager');
// const logger = require('../../../functions/logger');


class TaxCollectorManager extends ModelManager {
	constructor(options) {
		super(options);

		/**
		 * @type {import('discord.js').Collection<string, import('../models/TaxCollector')}
		 */
		this.cache;
		/**
		 * @type {import('../models/TaxCollector')}
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
	 * @param {string|import('../models/Player')} uuidOrPlayer
	 */
	async add(uuidOrPlayer) {
		const player = this.client.players.resolve(uuidOrPlayer);

		if (!player) throw new Error(`[TAX COLLECTOR ADD]: invalid input: ${uuidOrPlayer}`);

		return super.add({
			minecraftUUID: player.minecraftUUID,
			ign: player.ign,
			isCollecting: true,
			collectedTax: 0,
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

	/**
	 * returns a tax collected embed
	 */
	createTaxCollectedEmbed() {
		const embed = new MessageEmbed()
			.setColor(this.client.config.get('EMBED_BLUE'))
			.setTitle('Collected Guild Tax')
			.setDescription(stripIndents`
				**combined**
				tax: ${this.client.formatNumber(this.cache.reduce((acc, collector) => acc + collector.collectedTax, 0), 0)}
				donations: ${this.client.formatNumber(this.cache.reduce((acc, collector) => acc + collector.collectedDonations, 0), 0)}
				total: ${this.client.formatNumber(this.cache.reduce((acc, collector) => acc + collector.collectedTax + collector.collectedDonations, 0), 0)}
				\u200b
			`)
			.setTimestamp();

		for (const taxCollector of this.cache.values()) {
			embed.addField(
				`${escapeIgn(taxCollector.ign)}${taxCollector.isCollecting ? '' : ' (inactive)'}`,
				stripIndents`
					tax: ${this.client.formatNumber(taxCollector.collectedTax)}
					donations: ${this.client.formatNumber(taxCollector.collectedDonations)}
					total: ${this.client.formatNumber(taxCollector.collectedTax + taxCollector.collectedDonations)}
				`,
			);
		}

		return embed;
	}
}

module.exports = TaxCollectorManager;
