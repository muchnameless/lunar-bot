import { Model, DataTypes } from 'sequelize';
import { TransactionType } from './Transaction';
import type {
	CreationOptional,
	InferAttributes,
	InferCreationAttributes,
	ModelStatic,
	NonAttribute,
	Sequelize,
} from 'sequelize';
import type { LunarClient } from '../../LunarClient';
import type { Player } from './Player';

export class TaxCollector extends Model<InferAttributes<TaxCollector>, InferCreationAttributes<TaxCollector>> {
	declare client: NonAttribute<LunarClient>;

	declare minecraftUuid: string;
	declare isCollecting: CreationOptional<boolean>;
	declare collectedTax: CreationOptional<number>;
	declare collectedDonations: CreationOptional<number>;

	declare readonly createdAt: CreationOptional<Date>;
	declare readonly updatedAt: CreationOptional<Date>;

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
				createdAt: DataTypes.DATE,
				updatedAt: DataTypes.DATE,
			},
			{
				sequelize,
			},
		) as ModelStatic<TaxCollector>;
	}

	get player(): NonAttribute<Player | null> {
		return this.client.players.cache.get(this.minecraftUuid) ?? null;
	}

	get ign(): NonAttribute<string | null> {
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
