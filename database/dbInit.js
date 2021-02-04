'use strict';

const { sequelize } = require('./models/index');
const logger = require('../src/functions/logger');

sequelize.options.logging = x => logger.debug(x);

const force = process.argv.includes('--force') || process.argv.includes('-f');
const alter = process.argv.includes('--alter') || process.argv.includes('-a');

sequelize.sync({ force, alter }).then(() => {
	logger.info('Database synced');
	sequelize.close();
}).catch(logger.error);
