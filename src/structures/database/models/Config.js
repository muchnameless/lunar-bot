import pkg from 'sequelize';
const { Model, DataTypes } = pkg;


export class Config extends Model {
	constructor(...args) {
		super(...args);

		/**
		 * @type {import('../../LunarClient').LunarClient}
		 */
		this.client;
		/**
		 * @type {string}
		 */
		this.key;
		/**
		 * @type {string}
		 */
		this.value;
		/**
		 * @type {*}
		 */
		this.parsedValue = JSON.parse(this.value);
	}

	/**
	 * @param {import('sequelize').Sequelize} sequelize
	 */
	static init(sequelize) {
		return super.init({
			key: {
				type: DataTypes.STRING,
				primaryKey: true,
			},
			value: {
				type: DataTypes.STRING,
				allowNull: true,
				set(value) {
					this.parsedValue = value;
					return this.setDataValue('value', JSON.stringify(value));
				},
			},
		}, {
			sequelize,
			modelName: 'Config',
			timestamps: false,
			freezeTableName: true,
		});
	}
}

export default Config;
