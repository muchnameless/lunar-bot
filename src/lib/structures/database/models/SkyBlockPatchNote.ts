import {
	Model,
	DataTypes,
	type CreationOptional,
	type InferAttributes,
	type InferCreationAttributes,
	type ModelStatic,
	type NonAttribute,
	type Sequelize,
} from 'sequelize';
import { type LunarClient } from '#structures/LunarClient.js';

export class SkyBlockPatchNote extends Model<
	InferAttributes<SkyBlockPatchNote>,
	InferCreationAttributes<SkyBlockPatchNote>
> {
	public declare readonly client: NonAttribute<LunarClient>;

	public declare guid: number;

	public declare title: string;

	public declare creator: string;

	public declare link: string;

	public declare readonly createdAt: CreationOptional<Date>;

	public declare readonly updatedAt: CreationOptional<Date>;

	public static initialise(sequelize: Sequelize) {
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
