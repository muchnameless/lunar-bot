import { env } from 'node:process';
import pg from 'pg';
import { Sequelize, DataTypes } from 'sequelize';

// to get bigints as numbers instead of strings
pg.defaults.parseInt8 = true;
pg.types.setTypeParser(1_700, Number.parseFloat);

// use floats instead of strings as decimal representation (1/2)
// @ts-expect-error Base constructors must all have the same return type
class CustomDecimal extends DataTypes.DECIMAL {
	public static parse(value: string) {
		return Number.parseFloat(value);
	}
}

export const sequelize = new Sequelize({
	dialect: 'postgres',
	host: env.PGHOST,
	database: env.PGDATABASE,
	username: env.PGUSERNAME,
	password: env.PGPASSWORD,

	logging: false,

	// use floats instead of strings as decimal representation (2/2)
	hooks: {
		afterConnect() {
			const dTypes = {
				DECIMAL: CustomDecimal,
			};
			// @ts-expect-error Base constructors must all have the same return type ...
			this.connectionManager.refreshTypeParser(dTypes);
		},
	},
});
