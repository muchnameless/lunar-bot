import { Model, DataTypes } from 'sequelize';
import type { ModelStatic, Sequelize, Optional } from 'sequelize';
import type { LunarClient } from '../../LunarClient';

interface SkyBlockAuctionAttributes {
	id: string;
	lowestBIN: number;
	lowestBINHistory: number[];
}

type SkyBlockAuctionCreationAttributes = Optional<SkyBlockAuctionAttributes, 'lowestBIN' | 'lowestBINHistory'>;

export class SkyBlockAuction
	extends Model<SkyBlockAuctionAttributes, SkyBlockAuctionCreationAttributes>
	implements SkyBlockAuctionAttributes
{
	declare client: LunarClient;

	declare id: string;
	declare lowestBIN: number;
	declare lowestBINHistory: number[];

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
