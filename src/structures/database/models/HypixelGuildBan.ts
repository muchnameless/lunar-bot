import pkg from 'sequelize';
const { Model, DataTypes } = pkg;
import type { ModelStatic, Sequelize } from 'sequelize';
import type { LunarClient } from '../../LunarClient';


interface ConfigAttributes {
	minecraftUuid: string;
	_reason: string | null;
}


export class HypixelGuildBan extends Model<ConfigAttributes> {
	declare client: LunarClient;

	declare minecraftUuid: string;
	declare _reason: string | null;

	get reason() {
		return this._reason ?? 'no reason';
	}

	static initialise(sequelize: Sequelize) {
		return this.init({
			minecraftUuid: {
				type: DataTypes.STRING,
				primaryKey: true,
			},
			_reason: {
				type: DataTypes.STRING,
				allowNull: true,
			},
		}, {
			sequelize,
			modelName: 'HypixelGuildBan',
		}) as ModelStatic<HypixelGuildBan>;
	}
}

export default HypixelGuildBan;
