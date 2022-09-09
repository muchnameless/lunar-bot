import {
	DataTypes,
	Model,
	type Attributes,
	type CreationOptional,
	type InferAttributes,
	type InferCreationAttributes,
	type InstanceDestroyOptions,
	type InstanceUpdateOptions,
	type ModelStatic,
	type NonAttribute,
	type Sequelize,
} from 'sequelize';
import { type Player } from './Player.js';
import { TransactionType } from './Transaction.js';
import { assertNever } from '#functions';
import { type LunarClient } from '#structures/LunarClient.js';

export class TaxCollector extends Model<InferAttributes<TaxCollector>, InferCreationAttributes<TaxCollector>> {
	public declare readonly client: NonAttribute<LunarClient>;

	public declare minecraftUuid: string;

	public declare isCollecting: CreationOptional<boolean>;

	public declare collectedTax: CreationOptional<number>;

	public declare collectedDonations: CreationOptional<number>;

	public declare readonly createdAt: CreationOptional<Date>;

	public declare readonly updatedAt: CreationOptional<Date>;

	public static initialise(sequelize: Sequelize) {
		return this.init(
			{
				minecraftUuid: {
					type: DataTypes.TEXT,
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

	public get player(): NonAttribute<Player | null> {
		return this.client.players.cache.get(this.minecraftUuid) ?? null;
	}

	public get ign(): NonAttribute<string | null> {
		return this.player?.ign ?? null;
	}

	public get logInfo(): NonAttribute<Record<string, unknown>> {
		return this.player?.logInfo ?? { minecraftUuid: this.minecraftUuid };
	}

	/**
	 * adds the amount to the taxCollector's collected amount
	 *
	 * @param amount
	 * @param type
	 * @param options
	 */
	public addAmount(
		amount: number,
		type = TransactionType.Tax,
		options?: InstanceUpdateOptions<Attributes<TaxCollector>>,
	) {
		let data;

		switch (type) {
			case TransactionType.Tax:
				data = { collectedTax: this.collectedTax + amount };
				break;

			case TransactionType.Donation:
				data = { collectedDonations: this.collectedDonations + amount };
				break;

			default:
				return assertNever(type);
		}

		return this.update(data, options);
	}

	/**
	 * resets the specified amount back to 0
	 *
	 * @param type
	 */
	public resetAmount(type = TransactionType.Tax) {
		switch (type) {
			case TransactionType.Tax:
				return this.update({ collectedTax: 0 });

			case TransactionType.Donation:
				return this.update({ collectedDonations: 0 });

			default:
				return assertNever(type);
		}
	}

	/**
	 * destroys the db entry and removes it from cache
	 */
	public override async destroy(options?: InstanceDestroyOptions) {
		this.client.taxCollectors.cache.delete(this.minecraftUuid);
		return super.destroy(options);
	}

	/**
	 * player IGN or UUID
	 */
	public override toString() {
		return this.ign ?? this.minecraftUuid;
	}
}

export default TaxCollector;
