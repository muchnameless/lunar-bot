import { Model, DataTypes } from 'sequelize';
import { TransactionType } from './Transaction';
import type { ModelStatic, Optional, Sequelize } from 'sequelize';
import type { LunarClient } from '../../LunarClient';

interface TaxCollectorAttributes {
	minecraftUuid: string;
	isCollecting: boolean;
	collectedTax: number;
	collectedDonations: number;
}

type TaxCollectorCreationAttributes = Optional<
	TaxCollectorAttributes,
	'isCollecting' | 'collectedTax' | 'collectedDonations'
>;

export class TaxCollector
	extends Model<TaxCollectorAttributes, TaxCollectorCreationAttributes>
	implements TaxCollectorAttributes
{
	declare client: LunarClient;

	declare minecraftUuid: string;
	declare isCollecting: boolean;
	declare collectedTax: number;
	declare collectedDonations: number;

	declare readonly createdAt: Date;
	declare readonly updatedAt: Date;

	static initialise(sequelize: Sequelize) {
		return this.init(
			{
				minecraftUuid: {
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
			},
			{
				sequelize,
			},
		) as ModelStatic<TaxCollector>;
	}

	get player() {
		return this.client.players.cache.get(this.minecraftUuid) ?? null;
	}

	get ign() {
		return this.player?.ign ?? null;
	}

	/**
	 * adds the amount to the taxCollector's collected amount
	 * @param amount
	 * @param type
	 */
	addAmount(amount: number, type = TransactionType.Tax) {
		switch (type) {
			case TransactionType.Tax:
				return this.update({ collectedTax: this.collectedTax + amount });

			case TransactionType.Donation:
				return this.update({ collectedDonations: this.collectedDonations + amount });

			default: {
				const e: never = type;
				throw new Error(`[ADD AMOUNT]: ${this}: unknown type '${e}'`);
			}
		}
	}

	/**
	 * resets the specified amount back to 0
	 * @param type
	 */
	resetAmount(type = TransactionType.Tax) {
		switch (type) {
			case TransactionType.Tax:
				return this.update({ collectedTax: 0 });

			case TransactionType.Donation:
				return this.update({ collectedDonations: 0 });

			default: {
				const e: never = type;
				throw new Error(`[RESET AMOUNT]: ${this}: unknown type '${e}'`);
			}
		}
	}

	/**
	 * removes the collector from the database
	 */
	remove() {
		return this.client.taxCollectors.remove(this);
	}

	/**
	 * player IGN or UUID
	 */
	override toString() {
		return this.ign ?? this.minecraftUuid;
	}
}

export default TaxCollector;
