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

export class HypixelGuildBan extends Model<InferAttributes<HypixelGuildBan>, InferCreationAttributes<HypixelGuildBan>> {
	declare client: NonAttribute<LunarClient>;

	declare minecraftUuid: string;
	declare _reason: string | null;

	declare readonly createdAt: CreationOptional<Date>;
	declare readonly updatedAt: CreationOptional<Date>;

	get reason(): NonAttribute<string> {
		return this._reason ?? 'no reason specified';
	}

	static initialise(sequelize: Sequelize) {
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
