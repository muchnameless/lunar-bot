import pkg from 'sequelize';
const { Model, DataTypes } = pkg;
import type { ModelStatic, Sequelize } from 'sequelize';
import type { LunarClient } from '../../LunarClient';


export interface TransactionAttributes {
	from: string;
	to: string;
	amount: number;
	auctionId: string | null;
	notes: string | null;
	type: 'tax' | 'donation';
}


export class Transaction extends Model<TransactionAttributes> implements TransactionAttributes {
	declare client: LunarClient;

	declare id: number;
	declare from: string;
	declare to: string;
	declare amount: number;
	declare auctionId: string | null;
	declare notes: string | null;
	declare type: 'tax' | 'donation';

	declare readonly createdAt: Date;
	declare readonly updatedAt: Date;

	static initialise(sequelize: Sequelize) {
		return this.init({
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
			auctionId: { // hypixel api auction uuid
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
				type: DataTypes.ENUM('tax', 'donation'),
				defaultValue: 'tax',
				allowNull: false,
			},
		}, {
			sequelize,
			modelName: 'Transaction',
		}) as ModelStatic<Transaction>;
	}
}

export default Transaction;
