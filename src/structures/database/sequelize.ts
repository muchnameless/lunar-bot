import { env } from 'node:process';
import { Sequelize, DataTypes } from 'sequelize';
import pg from 'pg';

// to get bigints as numbers instead of strings
pg.defaults.parseInt8 = true;
pg.types.setTypeParser(1_700, Number.parseFloat);

// use floats instead of strings as decimal representation (1/2)
// @ts-expect-error
class CustomDecimal extends DataTypes.DECIMAL {
	static parse(value: string) {
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
			// @ts-expect-error
			this.connectionManager.refreshTypeParser(dTypes);
		},
	},
});
