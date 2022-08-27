import { URL } from 'node:url';
import { logger } from '#logger';
import { readJSFiles } from '#functions';
import { sequelize } from './sequelize';
import type { Model } from 'sequelize';
import type { Models } from './managers/DatabaseManager';

const models = {};

for await (const path of readJSFiles(new URL('models/', import.meta.url))) {
	const model = (await import(path)).default as typeof Model;

	if (
		!(
			typeof (
				// @ts-expect-error
				model.initialise
			) === 'function'
		)
	) {
		logger.error(`${model.name} is missing an initialise function`);
	}

	Reflect.set(
		models,
		model.name,
		// @ts-expect-error
		model.initialise(sequelize),
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

export { sequelize };
export { sql } from './sql';
