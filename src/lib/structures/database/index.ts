import { URL } from 'node:url';
import { findFilesRecursivelyStringEndsWith } from '@sapphire/node-utilities';
import type { Model } from 'sequelize';
import type { Models } from './managers/DatabaseManager.js';
import { sequelize } from './sequelize.js';
import { logger } from '#logger';

const models = {};

for await (const path of findFilesRecursivelyStringEndsWith(new URL('models', import.meta.url), '.js')) {
	const model = (await import(path)).default as typeof Model;

	if (
		typeof (
			// @ts-expect-error Property 'initialise' does not exist on type 'typeof Model'
			model.initialise
		) !== 'function'
	) {
		logger.error(`${model.name} is missing an initialise function`);
	}

	Reflect.set(
		models,
		model.name,
		// @ts-expect-error Property 'initialise' does not exist on type 'typeof Model'
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

export { sql } from './sql.js';

export { sequelize } from './sequelize.js';
