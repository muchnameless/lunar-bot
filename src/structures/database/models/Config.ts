import { Model, DataTypes } from 'sequelize';
import type { Sequelize, InferAttributes, InferCreationAttributes, ModelStatic } from 'sequelize';
import type { LunarClient } from '../../LunarClient';

export class Config extends Model<
	InferAttributes<Config, { omit: 'client' }>,
	InferCreationAttributes<Config, { omit: 'client' }>
> {
	declare client: LunarClient;

	declare key: string;
	declare value: string | null;

	parsedValue: unknown;

	constructor(...args: any[]) {
		super(...args);

		this.parsedValue = this.value !== null ? JSON.parse(this.value) : null;
	}

	static initialise(sequelize: Sequelize) {
		return this.init(
			{
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
			},
			{
				sequelize,
				timestamps: false,
				freezeTableName: true,
			},
		) as ModelStatic<Config>;
	}
}

export default Config;
