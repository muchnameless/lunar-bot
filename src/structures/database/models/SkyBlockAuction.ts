import { Model, DataTypes } from 'sequelize';
import type { ModelStatic, Sequelize } from 'sequelize';
import type { LunarClient } from '../../LunarClient';

interface SkyBlockAuctionAttributes {
	id: string;
	lowestBin: number;
}

export class SkyBlockAuction extends Model<SkyBlockAuctionAttributes> implements SkyBlockAuctionAttributes {
	declare client: LunarClient;

	declare id: string;
	declare lowestBin: number;

	static initialise(sequelize: Sequelize) {
		return this.init(
			{
				id: {
					type: DataTypes.STRING,
					primaryKey: true,
				},
				lowestBin: {
					type: DataTypes.DECIMAL,
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
