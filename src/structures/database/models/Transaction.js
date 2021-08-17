import pkg from 'sequelize';
const { Model, DataTypes } = pkg;

/**
 * @typedef {object} Transaction
 * @property {string} from
 * @property {string} to
 * @property {number} amount
 * @property {?string} auctionId
 * @property {?string} notes
 * @property {string} type
 */


export class Transaction extends Model {
	constructor(...args) {
		super(...args);

		/**
		 * @type {import('../../LunarClient').LunarClient}
		 */
		this.client;
	}

	/**
	 * @param {import('sequelize').Sequelize} sequelize
	 */
	static init(sequelize) {
		return super.init({
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
				type: DataTypes.ENUM([ 'tax', 'donation' ]),
				defaultValue: 'tax',
				allowNull: false,
			},
		}, {
			sequelize,
			modelName: 'Transaction',
		});
	}
}

export default Transaction;
