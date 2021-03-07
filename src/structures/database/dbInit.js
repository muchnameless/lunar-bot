'use strict';

require('./pgEnum-fix'); // to allow `sync --alter` with pg enums set
const { sequelize } = require('./index');
const logger = require('../../functions/logger');

sequelize.options.logging = x => logger.debug(x);

const force = process.argv.includes('--force') || process.argv.includes('-f');
const alter = process.argv.includes('--alter') || process.argv.includes('-a');

sequelize
	.sync({ force, alter })
	.then(
		() => {
			logger.info('Database synced');
			sequelize.close();
		},
		logger.error,
	);
