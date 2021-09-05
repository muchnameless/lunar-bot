import { Formatters } from 'discord.js';
import { stripIndents } from 'common-tags';
import { escapeIgn } from '../../../functions/index.js';
import { ModelManager } from './ModelManager.js';


export class TaxCollectorManager extends ModelManager {
	constructor(options) {
		super(options);

		/**
		 * @type {import('discord.js').Collection<string, import('../models/TaxCollector').TaxCollector}
		 */
		this.cache;
		/**
		 * @type {typeof import('../models/TaxCollector').TaxCollector}
		 */
		this.model;
	}

	/**
	 * returns a collection of all currently active collectors
	 */
	get activeCollectors() {
		return this.cache.filter(({ isCollecting }) => isCollecting);
	}

	/**
	 * add a player as a taxcollector
	 * @param {string|import('../models/Player').Player} uuidOrPlayer
	 */
	async add(uuidOrPlayer) {
		const player = this.client.players.resolve(uuidOrPlayer);

		if (!player) throw new Error(`[TAX COLLECTOR ADD]: invalid input: ${uuidOrPlayer}`);

		const [ newEntry, created ] = await this.model.findOrCreate({
			where: {
				minecraftUuid: player.minecraftUuid,
			},
			defaults: {
				ign: player.ign,
				isCollecting: true,
				collectedTax: 0,
			},
		});

		// entry already exists
		if (!created) await newEntry.update({ isCollecting: true });

		this.cache.set(newEntry[this.primaryKey], newEntry);

		return newEntry;
	}

	/**
	 * get a taxCollector by their discord ID
	 * @param {string} id
	 */
	getById(id) {
		return this.cache.get(this.client.players.getById(id)?.minecraftUuid) ?? null;
	}

	/**
	 * get a taxCollector by their IGN, case insensitive and with auto-correction
	 * @param {string} ign
	 */
	getByIgn(ign) {
		return this.cache.get(this.client.players.getByIgn(ign)?.minecraftUuid) ?? null;
	}

	/**
	 * returns a tax collected embed
	 */
	createTaxCollectedEmbed() {
		const embed = this.client.defaultEmbed
			.setTitle('Collected Guild Tax')
			.setDescription(stripIndents`
				${Formatters.bold('combined')}
				tax: ${this.client.formatNumber(this.cache.reduce((acc, collector) => acc + collector.collectedTax, 0), 0)}
				donations: ${this.client.formatNumber(this.cache.reduce((acc, collector) => acc + collector.collectedDonations, 0), 0)}
				total: ${this.client.formatNumber(this.cache.reduce((acc, collector) => acc + collector.collectedTax + collector.collectedDonations, 0), 0)}
				\u200b
			`);

		for (const taxCollector of this.cache.values()) {
			embed.addFields({
				name: `${escapeIgn(taxCollector.ign)}${taxCollector.isCollecting ? '' : ' (inactive)'}`,
				value: stripIndents`
					tax: ${this.client.formatNumber(taxCollector.collectedTax)}
					donations: ${this.client.formatNumber(taxCollector.collectedDonations)}
					total: ${this.client.formatNumber(taxCollector.collectedTax + taxCollector.collectedDonations)}
				`,
			});
		}

		return embed;
	}
}
