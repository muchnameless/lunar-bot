const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const Sequelize = require('sequelize');
// const { logger } = require('./functions/logger');

// use floats instead of strings as decimal representation
// Sequelize.postgres.DECIMAL.parse = parseFloat;

// use floats instead of strings as decimal representation (cleaner way) (1/2)
class CustomDecimal extends Sequelize.DataTypes.DECIMAL {
	static parse(value) {
		return parseFloat(value);
	}
}

module.exports = {
	development: {
		url: process.env.DEV_DATABASE_URL,
		dialect: 'postgres',
	},
	test: {
		url: process.env.TEST_DATABASE_URL,
		dialect: 'postgres',
	},
	production: {
		// eslint-disable-next-line camelcase
		use_env_variable: 'DATABASE_URL',

		logging: false,

		// use floats instead of strings as decimal representation (cleaner way) (2/2)
		hooks: {
			afterConnect: function() {
				const dTypes = {
					DECIMAL: CustomDecimal,
				};
				this.connectionManager.refreshTypeParser(dTypes);
			},
		},
	},
};
