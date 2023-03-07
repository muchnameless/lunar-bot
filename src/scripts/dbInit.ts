import { argv, exit } from 'node:process';
import { sequelize } from '#db';
import { logger } from '#logger';

// @ts-expect-error Property 'options' does not exist on type 'Sequelize'
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
