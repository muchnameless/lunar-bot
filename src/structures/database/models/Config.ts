import { Model, DataTypes } from 'sequelize';
import type {
	InferAttributes,
	InferCreationAttributes,
	InstanceDestroyOptions,
	ModelStatic,
	NonAttribute,
	Sequelize,
} from 'sequelize';
import type { LunarClient } from '../../LunarClient';

export class Config extends Model<
	InferAttributes<Config, { omit: 'parsedValue' }>,
	InferCreationAttributes<Config, { omit: 'parsedValue' }>
> {
	declare client: NonAttribute<LunarClient>;

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
					type: DataTypes.TEXT,
					primaryKey: true,
				},
				value: {
					type: DataTypes.TEXT,
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

	/**
	 * destroys the db entry and removes it from cache
	 */
	override destroy(options?: InstanceDestroyOptions) {
		this.client.config.cache.delete(this.key);
		return super.destroy(options);
	}
}

export default Config;
