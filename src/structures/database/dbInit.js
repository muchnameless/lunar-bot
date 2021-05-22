'use strict';

require('./pgEnum-fix'); // to allow `sync --alter` with pg enums set
const { sequelize } = require('./index');
const logger = require('../../functions/logger');

sequelize.options.logging = x => logger.debug(x);

const force = process.argv.includes('--force') || process.argv.includes('-f');
const alter = process.argv.includes('--alter') || process.argv.includes('-a');


(async () => {
	try {
		await sequelize.sync({ force, alter });
		logger.info('Database synced');
		await sequelize.close();
		process.exit(0);
	} catch (error) {
		logger.error(error);
		process.exit(-1);
	}
})();
