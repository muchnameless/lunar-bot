import { Model, DataTypes } from 'sequelize';
import type { ModelStatic, Sequelize, Optional } from 'sequelize';
import type { LunarClient } from '../../LunarClient';

interface SkyBlockBazaarAttributes {
	id: string;
	buyPrice: number;
	buyPriceHistory: number[];
}

type SkyBlockBazaarCreationAttributes = Optional<SkyBlockBazaarAttributes, 'buyPrice' | 'buyPriceHistory'>;

export class SkyBlockBazaar
	extends Model<SkyBlockBazaarAttributes, SkyBlockBazaarCreationAttributes>
	implements SkyBlockBazaarAttributes
{
	declare client: LunarClient;

	declare id: string;
	declare buyPrice: number;
	declare buyPriceHistory: number[];

	static initialise(sequelize: Sequelize) {
		return this.init(
			{
				id: {
					type: DataTypes.STRING,
					primaryKey: true,
				},
				buyPrice: {
					type: DataTypes.DECIMAL,
					defaultValue: 0,
					allowNull: false,
				},
				buyPriceHistory: {
					type: DataTypes.ARRAY(DataTypes.DECIMAL),
					defaultValue: [],
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
