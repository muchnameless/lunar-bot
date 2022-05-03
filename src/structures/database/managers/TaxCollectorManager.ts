import { bold } from 'discord.js';
import { stripIndents } from 'common-tags';
import { escapeIgn, formatNumber } from '../../../functions';
import { ModelManager } from './ModelManager';
import type { TaxCollector } from '../models/TaxCollector';
import type { ModelResovable } from './ModelManager';
import type { Player } from '../models/Player';

export class TaxCollectorManager extends ModelManager<TaxCollector> {
	/**
	 * returns a collection of all currently active collectors
	 */
	get activeCollectors() {
		return this.cache.filter(({ isCollecting }) => isCollecting);
	}

	/**
	 * add a player as a taxcollector
	 * @param uuidOrPlayer
	 */
	// @ts-expect-error
	override async add(uuidOrPlayer: ModelResovable<Player>) {
		const player = this.client.players.resolve(uuidOrPlayer);
		if (!player) throw new Error(`[TAX COLLECTOR ADD]: invalid input: ${uuidOrPlayer}`);

		const [newEntry, created] = await this.model.findCreateFind({
			where: {
				minecraftUuid: player.minecraftUuid,
			},
			// do I need to specify minecraftUuid here again???
			defaults: {
				minecraftUuid: player.minecraftUuid,
				isCollecting: true,
			},
		});

		// entry already exists
		if (!created) await newEntry.update({ isCollecting: true });

		this.cache.set(newEntry[this.primaryKey] as string, newEntry);

		return newEntry;
	}

	/**
	 * get a taxCollector by their discord ID
	 * @param id
	 */
	getById(id: string) {
		return this.cache.get(this.client.players.getById(id)?.minecraftUuid!) ?? null;
	}

	/**
	 * get a taxCollector by their IGN, case insensitive and with auto-correction
	 * @param ign
	 */
	getByIgn(ign: string) {
		return this.cache.get(this.client.players.getByIgn(ign)?.minecraftUuid!) ?? null;
	}

	/**
	 * returns a tax collected embed
	 */
	createTaxCollectedEmbed() {
		const embed = this.client.defaultEmbed //
			.setTitle('Collected Guild Tax') //
			.setDescription(stripIndents`
				${bold('combined')}
				tax: ${formatNumber(this.cache.reduce((acc, collector) => acc + collector.collectedTax, 0))}
				donations: ${formatNumber(this.cache.reduce((acc, collector) => acc + collector.collectedDonations, 0))}
				total: ${formatNumber(
					this.cache.reduce((acc, collector) => acc + collector.collectedTax + collector.collectedDonations, 0),
				)}
				\u200B
			`);

		for (const taxCollector of this.cache.values()) {
			embed.addFields([
				{
					name: `${escapeIgn(`${taxCollector}`)}${taxCollector.isCollecting ? '' : ' (inactive)'}`,
					value: stripIndents`
						tax: ${formatNumber(taxCollector.collectedTax)}
						donations: ${formatNumber(taxCollector.collectedDonations)}
						total: ${formatNumber(taxCollector.collectedTax + taxCollector.collectedDonations)}
					`,
				},
			]);
		}

		return embed;
	}
}
