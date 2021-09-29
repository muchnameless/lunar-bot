import pkg from 'sequelize';
const { Model, DataTypes } = pkg;
import type { ModelStatic, Optional, Sequelize } from 'sequelize';
import type { LunarClient } from '../../LunarClient';


interface TaxCollectorAttributes {
	minecraftUuid: string;
	isCollecting: boolean;
	collectedTax: number;
	collectedDonations: number;
}

type TaxCollectorCreationAttributes = Optional<TaxCollectorAttributes, 'isCollecting' | 'collectedTax' | 'collectedDonations'>


export class TaxCollector extends Model<TaxCollectorAttributes, TaxCollectorCreationAttributes> implements TaxCollectorAttributes {
	declare public client: LunarClient;;

	declare public minecraftUuid: string;
	declare public isCollecting: boolean;
	declare public collectedTax: number;
	declare public collectedDonations: number;

	declare public readonly createdAt: Date;
	declare public readonly updatedAt: Date;

	static initialize(sequelize: Sequelize) {
		return this.init({
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
		}, {
			sequelize,
			modelName: 'TaxCollector',
		}) as ModelStatic<TaxCollector>;
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
	async addAmount(amount: number, type = 'tax') {
		switch (type) {
			case 'tax':
				this.collectedTax += amount;
				return this.save();

			case 'donation':
				this.collectedDonations += amount;
				return this.save();

			default:
				throw new Error(`[ADD AMOUNT]: ${this}: unknown type '${type}'`);
		}
	}

	/**
	 * resets the specified amount back to 0
	 * @param type
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
				throw new Error(`[RESET AMOUNT]: ${this}: unknown type '${type}'`);
		}
	}

	/**
	 * removes the collector from the database
	 */
	async remove() {
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
