import { Model, DataTypes } from 'sequelize';
import type {
	CreationOptional,
	InferAttributes,
	InferCreationAttributes,
	ModelStatic,
	NonAttribute,
	Sequelize,
} from 'sequelize';
import type { LunarClient } from '../../LunarClient';

export class Price extends Model<InferAttributes<Price>, InferCreationAttributes<Price>> {
	declare client: NonAttribute<LunarClient>;

	declare id: string;
	declare history: CreationOptional<number[]>;

	static initialise(sequelize: Sequelize) {
		return this.init(
			{
				id: {
					type: DataTypes.STRING,
					primaryKey: true,
				},
				history: {
					type: DataTypes.ARRAY(DataTypes.DECIMAL),
					defaultValue: [],
					allowNull: false,
				},
			},
			{
				sequelize,
				timestamps: false,
				tableName: 'price',
			},
		) as ModelStatic<Price>;
	}
}

export default Price;
