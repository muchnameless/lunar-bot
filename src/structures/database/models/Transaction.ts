import { Model, DataTypes } from 'sequelize';
import type { ModelStatic, Sequelize } from 'sequelize';
import type { LunarClient } from '../../LunarClient';

export const enum TransactionType {
	Tax = 'tax',
	Donation = 'donation',
}

export interface TransactionAttributes {
	from: string;
	to: string;
	amount: number;
	auctionId: string | null;
	notes: string | null;
	type: TransactionType;
}

export class Transaction extends Model<TransactionAttributes> implements TransactionAttributes {
	declare client: LunarClient;

	declare id: number;
	declare from: string;
	declare to: string;
	declare amount: number;
	declare auctionId: string | null;
	declare notes: string | null;
	declare type: TransactionType;

	declare readonly createdAt: Date;
	declare readonly updatedAt: Date;

	static initialise(sequelize: Sequelize) {
		return this.init(
			{
				from: {
					type: DataTypes.STRING,
					allowNull: false,
				},
				to: {
					type: DataTypes.STRING,
					allowNull: false,
				},
				amount: {
					type: DataTypes.BIGINT,
					defaultValue: 0,
					allowNull: false,
				},
				auctionId: {
					// hypixel api auction uuid
					type: DataTypes.STRING,
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
			},
			{
				sequelize,
			},
		) as ModelStatic<Transaction>;
	}
}

export default Transaction;
