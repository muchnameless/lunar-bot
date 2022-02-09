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

export class SkyBlockBazaar extends Model<InferAttributes<SkyBlockBazaar>, InferCreationAttributes<SkyBlockBazaar>> {
	declare client: NonAttribute<LunarClient>;

	declare id: string;
	declare buyPrice: CreationOptional<number>;
	declare buyPriceHistory: CreationOptional<number[]>;

	static initialise(sequelize: Sequelize) {
		return this.init(
			{
				id: {
					type: DataTypes.STRING,
					primaryKey: true,
				},
				buyPrice: {
					type: DataTypes.DECIMAL,
					defaultValue: 0,
					allowNull: false,
				},
				buyPriceHistory: {
					type: DataTypes.ARRAY(DataTypes.DECIMAL),
					defaultValue: [],
					allowNull: false,
				},
			},
			{
				sequelize,
				timestamps: false,
			},
		) as ModelStatic<SkyBlockBazaar>;
	}
}

export default SkyBlockBazaar;
