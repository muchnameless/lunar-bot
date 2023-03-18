import {
	Model,
	DataTypes,
	type ModelStatic,
	type Sequelize,
	type CreationOptional,
	type InferAttributes,
	type InferCreationAttributes,
	type NonAttribute,
} from 'sequelize';
import type { LunarClient } from '#structures/LunarClient.js';

export const enum TransactionType {
	Donation = 'donation',
	Tax = 'tax',
}

export class Transaction extends Model<InferAttributes<Transaction>, InferCreationAttributes<Transaction>> {
	public declare readonly client: NonAttribute<LunarClient>;

	public declare from: string;

	public declare to: string;

	public declare amount: number;

	public declare auctionId: string | null;

	public declare notes: string | null;

	public declare type: TransactionType;

	public declare readonly createdAt: CreationOptional<Date>;

	public declare readonly updatedAt: CreationOptional<Date>;

	public static initialise(sequelize: Sequelize) {
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
