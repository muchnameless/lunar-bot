import { config } from 'dotenv';
import { URL, fileURLToPath, pathToFileURL } from 'node:url';
config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });
import { readJSFiles } from '../../functions';
import type { Models } from './managers/DatabaseManager';


// to get bigints as numbers instead of strings
import pg from 'pg';

pg.defaults.parseInt8 = true;
pg.types.setTypeParser(1_700, parseFloat);

import pkg from 'sequelize';
const { Sequelize, DataTypes, Model } = pkg;

// use floats instead of strings as decimal representation (1/2)
// @ts-expect-error it works
class CustomDecimal extends DataTypes.DECIMAL {
	static parse(value: string) {
		return Number.parseFloat(value);
	}
}


export const sequelize = new Sequelize(
	process.env.DATABASE_URL as string,
	{
		logging: false,

		// use floats instead of strings as decimal representation (2/2)
		hooks: {
			afterConnect() {
				const dTypes = {
					DECIMAL: CustomDecimal,
				};
				// @ts-expect-error it works
				this.connectionManager.refreshTypeParser(dTypes);
			},
		},
	},
);


const models = {};

for await (const { fullPath } of readJSFiles(new URL('./models', import.meta.url))) {
	const model = (await import(pathToFileURL(fullPath).href)).default as typeof Model;

	// @ts-expect-error Property 'initialize' does not exist on type 'typeof Model'
	Reflect.set(models, model.name, model.initialize(sequelize));
}


export const db = {
	...models as Models,

	// add sequelize
	sequelize,
};

for (const model of Object.values(models) as any[]) {
	model.associate?.(db);
}
