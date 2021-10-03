import pkg from 'sequelize';
const { Model, DataTypes } = pkg;
import type { ModelStatic, Sequelize } from 'sequelize';
import type { LunarClient } from '../../LunarClient';


interface ConfigAttributes {
	key: string;
	value: string | null;
}


export class Config extends Model<ConfigAttributes> {
	declare client: LunarClient;

	declare key: string;
	declare value: string | null;
	parsedValue: unknown;

	constructor(...args: any[]) {
		super(...args);

		this.parsedValue = this.value !== null
			? JSON.parse(this.value)
			: null;
	}

	static initialise(sequelize: Sequelize) {
		return this.init({
			key: {
				type: DataTypes.STRING,
				primaryKey: true,
			},
			value: {
				type: DataTypes.STRING,
				allowNull: true,
				set(value) {
					(this as Config).parsedValue = value;
					return this.setDataValue('value', JSON.stringify(value));
				},
			},
		}, {
			sequelize,
			modelName: 'Config',
			timestamps: false,
			freezeTableName: true,
		}) as ModelStatic<Config>;
	}
}

export default Config;
