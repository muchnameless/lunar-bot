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

export class SkyBlockPatchNote extends Model<
	InferAttributes<SkyBlockPatchNote>,
	InferCreationAttributes<SkyBlockPatchNote>
> {
	declare client: NonAttribute<LunarClient>;

	declare guid: number;
	declare title: string;
	declare creator: string;
	declare link: string;

	declare readonly createdAt: CreationOptional<Date>;
	declare readonly updatedAt: CreationOptional<Date>;

	static initialise(sequelize: Sequelize) {
		return this.init(
			{
				guid: {
					type: DataTypes.INTEGER,
					primaryKey: true,
				},
				title: {
					type: DataTypes.TEXT,
					allowNull: false,
				},
				creator: {
					type: DataTypes.TEXT,
					allowNull: false,
				},
				link: {
					type: DataTypes.TEXT,
					allowNull: false,
				},
				createdAt: DataTypes.DATE,
				updatedAt: DataTypes.DATE,
			},
			{
				sequelize,
			},
		) as ModelStatic<SkyBlockPatchNote>;
	}
}

export default SkyBlockPatchNote;
