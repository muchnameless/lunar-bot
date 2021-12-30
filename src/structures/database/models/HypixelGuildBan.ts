import { Model, DataTypes } from 'sequelize';
import type { ModelStatic, Sequelize, Optional } from 'sequelize';
import type { LunarClient } from '../../LunarClient';

interface HypixelGuildBanAttributes {
	minecraftUuid: string;
	_reason: string | null;
}

type HypixelGuildBanCreationAttributes = Optional<HypixelGuildBanAttributes, '_reason'>;

export class HypixelGuildBan
	extends Model<HypixelGuildBanAttributes, HypixelGuildBanCreationAttributes>
	implements HypixelGuildBanAttributes
{
	declare client: LunarClient;

	declare minecraftUuid: string;
	declare _reason: string | null;

	declare readonly createdAt: Date;
	declare readonly updatedAt: Date;

	get reason() {
		return this._reason ?? 'no reason specified';
	}

	static initialise(sequelize: Sequelize) {
		return this.init(
			{
				minecraftUuid: {
					type: DataTypes.STRING,
					primaryKey: true,
				},
				_reason: {
					type: DataTypes.STRING,
					defaultValue: null,
					allowNull: true,
				},
			},
			{
				sequelize,
			},
		) as ModelStatic<HypixelGuildBan>;
	}
}

export default HypixelGuildBan;
