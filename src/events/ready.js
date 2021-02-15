'use strict';

const logger = require('../functions/logger');


/**
 * ready
 * @param {import('../structures/LunarClient')} client
 */
module.exports = async client => {
	logger.debug(`[READY]: logged in as ${client.user.tag}`);

	// Fetch all members for initially available guilds
	// if (client.options.fetchAllMembers) {
	// try {
	// 	const promises = client.guilds.cache.map(guild => guild.available ? guild.members.fetch().then(() => logger.debug(`[READY]: ${guild.name}: fetched all ${guild.memberCount} members`)) : Promise.resolve());
	// 	await Promise.all(promises);
	// } catch (error) {
	// 	logger.error(`Failed to fetch all members before ready! ${error}`);
	// }
	// }

	await client.initializeLoggingWebhook();

	const { config, cronJobs } = client;

	client.db.schedule();

	// resume command cron jobs
	await cronJobs.resume().catch(logger.error);

	// set presence again every 20 min cause it get's lost sometimes
	client.setInterval(() => {
		client.user
			.setPresence({
				activity: {
					name: `${config.get('PREFIX')}help`,
					type: 'LISTENING',
				},
				status: 'online',
			})
			.then(presence => config.getBoolean('EXTENDED_LOGGING') && logger.info(`Activity set to ${presence.activities[0].name}`))
			.catch(error => logger.error('error while setting activity:\n', error));
	}, 20 * 60 * 1_000); // 20 min

	// log ready
	logger.debug(`[READY]: startup complete. ${cronJobs.size} CronJobs running. Logging webhook available: ${Boolean(client.webhook)}`);
};
