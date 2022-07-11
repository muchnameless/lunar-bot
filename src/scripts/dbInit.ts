import { argv, exit } from 'node:process';
import '#structures/database/pgEnum-fix'; // to allow `sync --alter` with pg enums set
import { logger } from '#logger';
import { sequelize } from '#db';

// @ts-expect-error
sequelize.options.logging = (...x) => logger.debug(...x);

const force = argv.includes('--force') || argv.includes('-f');
const alter = argv.includes('--alter') || argv.includes('-a');

try {
	await sequelize.sync({ force, alter });
	logger.info('Database synced');
	await sequelize.close();
	exit(0);
} catch (error) {
	logger.error(error);
	exit(-1);
}
