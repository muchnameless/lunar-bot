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

export class SkyBlockAuction extends Model<InferAttributes<SkyBlockAuction>, InferCreationAttributes<SkyBlockAuction>> {
	declare client: NonAttribute<LunarClient>;

	declare id: string;
	declare lowestBIN: CreationOptional<number>;
	declare lowestBINHistory: CreationOptional<number[]>;

	static initialise(sequelize: Sequelize) {
		return this.init(
			{
				id: {
					type: DataTypes.STRING,
					primaryKey: true,
				},
				lowestBIN: {
					type: DataTypes.DECIMAL,
					defaultValue: 0,
					allowNull: false,
				},
				lowestBINHistory: {
					type: DataTypes.ARRAY(DataTypes.DECIMAL),
					defaultValue: [],
					allowNull: false,
				},
			},
			{
				sequelize,
				timestamps: false,
			},
		) as ModelStatic<SkyBlockAuction>;
	}
}

export default SkyBlockAuction;
