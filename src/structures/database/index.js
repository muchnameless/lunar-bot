'use strict';

const { join } = require('path');
require('dotenv').config({ path: join(__dirname, '..', '..', '..', '.env') });
const { readdirSync } = require('fs');

// to get bigints as numbers instead of strings
require('pg').defaults.parseInt8 = true;

const Sequelize = require('sequelize');

// use floats instead of strings as decimal representation (1/2)
class CustomDecimal extends Sequelize.DataTypes.DECIMAL {
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

const db = {

	// read models
	...Object.fromEntries(
		readdirSync(join(__dirname, 'models'))
			.filter(file => !file.startsWith('~') && file.endsWith('.js'))
			.map(file => {
				const model = require(join(__dirname, 'models', file));

				if (Object.getPrototypeOf(model) !== Sequelize.Model) return null;

				return [model.name, model.init(sequelize)];
			})
			.filter(Boolean),
	),

	// add sequelize
	sequelize,
	Sequelize,

	/**
	 * closes the sequelize connection to the sqlite db and exits the process optionally with an error based on the db response
	 */
	async closeConnectionAndExit() {
		try {
			const output = await sequelize.close();
			if (output) console.log(output);
			process.exit(0);
		} catch (error) {
			console.error(error);
			process.exit(1);
		}
	},
};

for (const dbEntry of Object.values(db).filter(value => Object.getPrototypeOf(value) === Sequelize.Model)) {
	dbEntry.associate?.(db);
}

module.exports = db;
