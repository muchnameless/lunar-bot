import { argv, exit } from 'node:process';
import '../structures/database/pgEnum-fix'; // to allow `sync --alter` with pg enums set
import { db } from '../structures/database';
import { logger } from '../functions';

// @ts-expect-error
db.sequelize.options.logging = (...x) => logger.debug(...x);

const force = argv.includes('--force') || argv.includes('-f');
const alter = argv.includes('--alter') || argv.includes('-a');

try {
	await db.sequelize.sync({ force, alter });
	logger.info('Database synced');
	await db.sequelize.close();
	exit(0);
} catch (error) {
	logger.error(error);
	exit(-1);
}
