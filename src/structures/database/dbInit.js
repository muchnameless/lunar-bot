import './pgEnum-fix.js'; // to allow `sync --alter` with pg enums set
import { sequelize } from './index.js';
import { logger } from '../../functions/logger.js';

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
