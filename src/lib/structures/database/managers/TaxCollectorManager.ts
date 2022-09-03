import { stripIndents } from 'common-tags';
import { bold } from 'discord.js';
import { type Player } from '../models/Player.js';
import { type TaxCollector } from '../models/TaxCollector.js';
import { ModelManager, type ModelResovable } from './ModelManager.js';
import { escapeIgn, formatNumber } from '#functions';

export type TaxCollectorResovable = ModelResovable<TaxCollector>;

export class TaxCollectorManager extends ModelManager<TaxCollector> {
	/**
	 * returns a collection of all currently active collectors
	 */
	public get activeCollectors() {
		return this.cache.filter(({ isCollecting }) => isCollecting);
	}

	/**
	 * add a player as a taxcollector
	 *
	 * @param uuidOrPlayer
	 */
	// @ts-expect-error incompatible override
	public override async add(uuidOrPlayer: ModelResovable<Player>) {
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
	 * changes the tax collectors isCollecting to false or deletes the entry if the collector didn't collect anything
	 *
	 * @param taxCollector
	 */
	public async setInactive(taxCollector: TaxCollectorResovable) {
		const _taxCollector = this.resolve(taxCollector);
		if (!_taxCollector) return this;

		const player =
			_taxCollector.player ?? (await this.client.players.fetch({ minecraftUuid: _taxCollector.minecraftUuid }));

		// remove self paid if only the collector paid the default amount at his own ah
		if (_taxCollector.collectedTax === this.client.config.get('TAX_AMOUNT')) {
			if (player && (await player.transactions)[0]?.to === player.minecraftUuid) await player.resetTax();
			await _taxCollector.destroy();
		} else {
			await _taxCollector.update({ isCollecting: false });
		}

		return this;
	}

	/**
	 * get a taxCollector by their discord ID
	 *
	 * @param id
	 */
	public getById(id: string) {
		// eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
		return this.cache.get(this.client.players.getById(id)?.minecraftUuid!) ?? null;
	}

	/**
	 * get a taxCollector by their IGN, case insensitive and with auto-correction
	 *
	 * @param ign
	 */
	public getByIgn(ign: string) {
		// eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
		return this.cache.get(this.client.players.getByIgn(ign)?.minecraftUuid!) ?? null;
	}

	/**
	 * returns a tax collected embed
	 */
	public createTaxCollectedEmbed() {
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
			embed.addFields({
				name: `${escapeIgn(`${taxCollector}`)}${taxCollector.isCollecting ? '' : ' (inactive)'}`,
				value: stripIndents`
					tax: ${formatNumber(taxCollector.collectedTax)}
					donations: ${formatNumber(taxCollector.collectedDonations)}
					total: ${formatNumber(taxCollector.collectedTax + taxCollector.collectedDonations)}
				`,
			});
		}

		return embed;
	}
}
