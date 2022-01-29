import { URL, pathToFileURL } from 'node:url';
import { env } from 'node:process';
import { Sequelize, DataTypes } from 'sequelize';
import pg from 'pg';
import { logger, readJSFiles } from '../../functions';
import type { Model } from 'sequelize';
import type { Models } from './managers/DatabaseManager';

// to get bigints as numbers instead of strings
pg.defaults.parseInt8 = true;
pg.types.setTypeParser(1_700, parseFloat);

// use floats instead of strings as decimal representation (1/2)
// @ts-expect-error
class CustomDecimal extends DataTypes.DECIMAL {
	static parse(value: string) {
		return Number.parseFloat(value);
	}
}

export const sequelize = new Sequelize(env.DATABASE_URL!, {
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

const models = {};

for await (const { fullPath } of readJSFiles(new URL('./models', import.meta.url))) {
	const model = (await import(pathToFileURL(fullPath).href)).default as typeof Model;

	if (
		!(
			typeof (
				// @ts-expect-error
				model.initialise
			) === 'function'
		)
	)
		logger.error(`${model.name} is missing an initialise function`);

	Reflect.set(
		models,
		model.name,
		// @ts-expect-error
		model['initialise' ?? 'init'](sequelize),
	);
}

export const db = {
	...(models as Models),

	// add sequelize
	sequelize,
};

for (const model of Object.values(models) as any[]) {
	model.associate?.(db);
}
