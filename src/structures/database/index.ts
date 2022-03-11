import { URL, pathToFileURL } from 'node:url';
import { logger, readJSFiles } from '../../functions';
import { sequelize } from './sequelize';
import type { Model } from 'sequelize';
import type { Models } from './managers/DatabaseManager';

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
