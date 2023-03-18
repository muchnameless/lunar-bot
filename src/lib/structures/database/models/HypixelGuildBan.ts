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
import type { LunarClient } from '#structures/LunarClient.js';

export class HypixelGuildBan extends Model<InferAttributes<HypixelGuildBan>, InferCreationAttributes<HypixelGuildBan>> {
	public declare readonly client: NonAttribute<LunarClient>;

	public declare minecraftUuid: string;

	public declare _reason: string | null;

	public declare readonly createdAt: CreationOptional<Date>;

	public declare readonly updatedAt: CreationOptional<Date>;

	public get reason(): NonAttribute<string> {
		return this._reason ?? 'no reason specified';
	}

	public static initialise(sequelize: Sequelize) {
		return this.init(
			{
				minecraftUuid: {
					type: DataTypes.TEXT,
					primaryKey: true,
				},
				_reason: {
					type: DataTypes.TEXT,
					defaultValue: null,
					allowNull: true,
				},
				createdAt: DataTypes.DATE,
				updatedAt: DataTypes.DATE,
			},
			{
				sequelize,
			},
		) as ModelStatic<HypixelGuildBan>;
	}
}

export default HypixelGuildBan;
