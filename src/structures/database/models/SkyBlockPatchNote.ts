import { Model, DataTypes } from 'sequelize';
import type { ModelStatic, Sequelize } from 'sequelize';
import type { LunarClient } from '../../LunarClient';

export interface HypixelForumPostAttributes {
	guid: number;
	title: string;
	creator: string;
	link: string;
}

type HypixelForumPostCreationAttributes = HypixelForumPostAttributes;

export class SkyBlockPatchNote
	extends Model<HypixelForumPostAttributes, HypixelForumPostCreationAttributes>
	implements HypixelForumPostAttributes
{
	declare client: LunarClient;

	declare guid: number;
	declare title: string;
	declare creator: string;
	declare link: string;

	declare readonly createdAt: Date;
	declare readonly updatedAt: Date;

	static initialise(sequelize: Sequelize) {
		return this.init(
			{
				guid: {
					type: DataTypes.INTEGER,
					primaryKey: true,
				},
				title: {
					type: DataTypes.STRING,
					allowNull: false,
				},
				creator: {
					type: DataTypes.STRING,
					allowNull: false,
				},
				link: {
					type: DataTypes.STRING,
					allowNull: false,
				},
			},
			{
				sequelize,
			},
		) as ModelStatic<SkyBlockPatchNote>;
	}
}

export default SkyBlockPatchNote;
