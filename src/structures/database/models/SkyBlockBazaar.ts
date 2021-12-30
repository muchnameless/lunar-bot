import { Model, DataTypes } from 'sequelize';
import type { ModelStatic, Sequelize } from 'sequelize';
import type { LunarClient } from '../../LunarClient';

interface SkyBlockBazaarAttributes {
	id: string;
	buyPrice: number;
}

export class SkyBlockBazaar extends Model<SkyBlockBazaarAttributes> implements SkyBlockBazaarAttributes {
	declare client: LunarClient;

	declare id: string;
	declare buyPrice: number;

	static initialise(sequelize: Sequelize) {
		return this.init(
			{
				id: {
					type: DataTypes.STRING,
					primaryKey: true,
				},
				buyPrice: {
					type: DataTypes.DECIMAL,
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
