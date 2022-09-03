import {
	Model,
	DataTypes,
	type InferAttributes,
	type InferCreationAttributes,
	type InstanceDestroyOptions,
	type ModelStatic,
	type NonAttribute,
	type Sequelize,
} from 'sequelize';
import { type LunarClient } from '#structures/LunarClient.js';

export class Config extends Model<
	InferAttributes<Config, { omit: 'parsedValue' }>,
	InferCreationAttributes<Config, { omit: 'parsedValue' }>
> {
	public declare readonly client: NonAttribute<LunarClient>;

	public declare key: string;

	public declare value: string | null;

	public parsedValue: unknown;

	public constructor(...args: any[]) {
		super(...args);

		this.parsedValue = this.value === null ? null : JSON.parse(this.value);
	}

	public static initialise(sequelize: Sequelize) {
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
						this.setDataValue('value', JSON.stringify(value));
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
	public override async destroy(options?: InstanceDestroyOptions) {
		this.client.config.cache.delete(this.key);
		return super.destroy(options);
	}
}

export default Config;
