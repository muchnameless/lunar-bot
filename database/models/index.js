'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV ?? 'production';
const config = require('../config/config')[env];

/**
 * @type {Sequelize}
 */
let sequelize;

if (config.use_env_variable) {
	sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
	sequelize = new Sequelize(config.database, config.username, config.password, config);
}

const db = {

	// read models
	...Object.fromEntries(
		fs
			.readdirSync(path.join(__dirname))
			.filter(file => !file.startsWith('~') && file.endsWith('.js') && file !== basename)
			.map(file => {
				const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
				return [model.name, model];
			}),
	),

	// add sequelize
	sequelize,
	Sequelize,

	/**
	 * closes the sequelize connection to the sqlite db and exits the process optionally with an error based on the db response
	 */
	closeConnectionAndExit: async () => {
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
