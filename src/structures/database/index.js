import { config } from 'dotenv';
import { fileURLToPath } from 'url';
config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });
import { readdir } from 'fs/promises';

// to get bigints as numbers instead of strings
import pg from 'pg';

pg.defaults.parseInt8 = true;
pg.types.setTypeParser(1700, parseFloat);

import pkg from 'sequelize';
const { Sequelize, DataTypes, Model } = pkg;

// use floats instead of strings as decimal representation (1/2)
class CustomDecimal extends DataTypes.DECIMAL {
	static parse(value) {
		return parseFloat(value);
	}
}

const sequelize = new Sequelize(
	process.env.DATABASE_URL,
	{
		logging: false,

		// use floats instead of strings as decimal representation (2/2)
		hooks: {
			afterConnect() {
				const dTypes = {
					DECIMAL: CustomDecimal,
				};
				this.connectionManager.refreshTypeParser(dTypes);
			},
		},
	},
);

export const db = {

	// read models
	...Object.fromEntries(
		(await Promise.all((await readdir('./src/structures/database/models'))
			.filter(file => !file.startsWith('~') && file.endsWith('.js'))
			.map(async (file) => {
				const model = (await import(`./models/${file}`)).default;

				if (Object.getPrototypeOf(model) !== Model) return null;

				return [ model.name, model.init(sequelize) ];
			}),
		)).filter(Boolean),
	),

	// add sequelize
	sequelize,
};

for (const dbEntry of Object.values(db).filter(value => Object.getPrototypeOf(value) === Model)) {
	dbEntry.associate?.(db);
}
