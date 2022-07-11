import { Model, DataTypes } from 'sequelize';
import type {
	ModelStatic,
	Sequelize,
	CreationOptional,
	InferAttributes,
	InferCreationAttributes,
	NonAttribute,
} from 'sequelize';
import type { LunarClient } from '../../LunarClient';

export const enum TransactionType {
	Tax = 'tax',
	Donation = 'donation',
}

export class Transaction extends Model<InferAttributes<Transaction>, InferCreationAttributes<Transaction>> {
	declare client: NonAttribute<LunarClient>;

	declare from: string;
	declare to: string;
	declare amount: number;
	declare auctionId: string | null;
	declare notes: string | null;
	declare type: TransactionType;

	declare readonly createdAt: CreationOptional<Date>;
	declare readonly updatedAt: CreationOptional<Date>;

	static initialise(sequelize: Sequelize) {
		return this.init(
			{
				from: {
					type: DataTypes.TEXT,
					allowNull: false,
				},
				to: {
					type: DataTypes.TEXT,
					allowNull: false,
				},
				amount: {
					type: DataTypes.BIGINT,
					defaultValue: 0,
					allowNull: false,
				},
				auctionId: {
					// hypixel api auction uuid
					type: DataTypes.TEXT,
					defaultValue: null,
					allowNull: true,
				},
				notes: {
					type: DataTypes.TEXT,
					defaultValue: null,
					allowNull: true,
				},
				type: {
					type: DataTypes.ENUM(TransactionType.Tax, TransactionType.Donation),
					defaultValue: TransactionType.Tax,
					allowNull: false,
				},
				createdAt: DataTypes.DATE,
				updatedAt: DataTypes.DATE,
			},
			{
				sequelize,
			},
		) as ModelStatic<Transaction>;
	}
}

export default Transaction;
