'use strict';

const { CronJob } = require('cron');
const { MAYOR_CHANGE_INTERVAL } = require('../constants/skyblock');
const { updatePlayerDatabase } = require('../functions/database');
const { restoreMessage, getWeekOfYear } = require('../functions/util');
const { startCompetition, endCompetition, performMayorReset, performDailyReset, performWeeklyReset, performMonthlyReset } = require('../functions/scheduledXpResets');
const updateDaPricesDatabase = require('../functions/updateDaPricesDatabase');
const logger = require('../functions/logger');


module.exports = async client => {
	logger.debug(`[READY]: logged in as ${client.user.tag}`);


	// Fetch all members for initially available guilds
	// if (client.options.fetchAllMembers) {
	try {
		const promises = client.guilds.cache.map(guild => guild.available ? guild.members.fetch().then(() => logger.debug(`[READY]: ${guild.name}: fetched all ${guild.memberCount} members`)) : Promise.resolve());
		await Promise.all(promises);
	} catch (error) {
		logger.error(`Failed to fetch all members before ready! ${error}`);
	}
	// }


	await client.initializeLoggingWebhook();


	const { config, db } = client;
	const now = new Date();

	// update player database and tax message every x min starting at the full hour
	client.cronJobs.set('updatePlayerDatabase', new CronJob({
		cronTime: `0 0/${config.get('DATABASE_UPDATE_INTERVAL')} * * * *`,
		onTick: () => config.getBoolean('PLAYER_DB_UPDATE_ENABLED') && updatePlayerDatabase(client),
		start: true,
	}));

	// update DA prices 1 min before DA
	client.cronJobs.set('updateDaPrices', new CronJob({
		cronTime: '0 54 * * * *',
		onTick: () => config.getBoolean('DA_PRICES_DB_UPDATE_ENABLED') && updateDaPricesDatabase(client),
		start: true,
	}));

	// auto competition starting
	if (config.getBoolean('COMPETITION_SCHEDULED')) {
		if (config.getNumber('COMPETITION_START_TIME') - 1000 > Date.now()) {
			client.cronJobs.set('competitionStart', new CronJob({
				cronTime: new Date(config.getNumber('COMPETITION_START_TIME')),
				onTick: () => startCompetition(client),
				start: true,
			}));
		} else if (!config.getBoolean('COMPETITION_RUNNING')) {
			startCompetition(client);
		}
	}

	// auto competition ending
	if (config.getNumber('COMPETITION_END_TIME') - 1000 > Date.now()) {
		client.cronJobs.set('competitionEnd', new CronJob({
			cronTime: new Date(config.getNumber('COMPETITION_END_TIME')),
			onTick: () => endCompetition(client),
			start: true,
		}));
	} else if (config.getBoolean('COMPETITION_RUNNING')) {
		endCompetition(client);
	}

	// mayor change reset
	const NEXT_MAYOR_TIME = config.getNumber('LAST_MAYOR_XP_RESET_TIME') + MAYOR_CHANGE_INTERVAL;

	if (NEXT_MAYOR_TIME - 1000 > Date.now()) {
		client.cronJobs.set('mayorXpReset', new CronJob({
			cronTime: new Date(NEXT_MAYOR_TIME),
			onTick: () => performMayorReset(client),
			start: true,
		}));
	} else {
		performMayorReset(client);
	}

	// daily reset
	if (new Date(config.getNumber('LAST_DAILY_XP_RESET_TIME')).getUTCDay() !== now.getUTCDay()) performDailyReset(client);

	// each day at 00:00:00
	client.cronJobs.set('dailyXpReset', new CronJob({
		cronTime: '0 0 0 * * *',
		timeZone: 'GMT',
		onTick: () => performDailyReset(client),
		start: true,
	}));

	// weekly reset
	if (getWeekOfYear(new Date(config.getNumber('LAST_WEEKLY_XP_RESET_TIME'))) !== getWeekOfYear(now)) performWeeklyReset(client);

	// each monday at 00:00:00
	client.cronJobs.set('weeklyXpReset', new CronJob({
		cronTime: '0 0 0 * * MON',
		timeZone: 'GMT',
		onTick: () => performWeeklyReset(client),
		start: true,
	}));

	// monthly reset
	if (new Date(config.getNumber('LAST_MONTHLY_XP_RESET_TIME')).getUTCMonth() !== now.getUTCMonth()) performMonthlyReset(client);

	// the first of each month at 00:00:00
	client.cronJobs.set('monthlyXpReset', new CronJob({
		cronTime: '0 0 0 1 * *',
		timeZone: 'GMT',
		onTick: () => performMonthlyReset(client),
		start: true,
	}));


	// resume command cron jobs
	await Promise.all((await db.CronJob.findAll()).map(async cronJob => {
		// expired while bot was offline
		if (Date.now() > cronJob.date - 1000) { // -100 cause CronJob throws error if times are too close
			db.CronJob.destroy({ where: { name: cronJob.name } });
			client.commands.getByName(cronJob.command).execute(await restoreMessage(client, cronJob), cronJob.args?.split(' ') ?? [], cronJob.flags?.split(' ') ?? []).catch(logger.error);
			return logger.info(`[CRONJOB]: ${cronJob.name}`);
		}

		client.cronJobs.set(cronJob.name, new CronJob({
			cronTime: new Date(cronJob.date),
			onTick: async () => {
				client.commands.getByName(cronJob.command).execute(await restoreMessage(client, cronJob), cronJob.args?.split(' ') ?? [], cronJob.flags?.split(' ') ?? []).catch(logger.error);
				client.cronJobs.delete(cronJob.name);
				db.CronJob.destroy({ where: { name: cronJob.name } });
				logger.info(`[CRONJOB]: ${cronJob.name}`);
			},
			start: true,
		}));
	}));


	// set presence again every 20 min cause it get's lost sometimes
	client.setInterval(() => {
		client.user
			.setPresence({
				activity: {
					name: `${client.config.get('PREFIX')}help`,
					type: 'LISTENING',
				},
				status: 'online',
			})
			.then(presence => client.config.getBoolean('EXTENDED_LOGGING') && logger.info(`Activity set to ${presence.activities[0].name}`))
			.catch(error => logger.error('error while setting activity:\n', error));
	}, 20 * 60 * 1000); // 20 min


	// log ready
	logger.debug(`[READY]: startup complete. ${client.cronJobs.size} CronJobs running. Logging webhook available: ${Boolean(client.webhook)}`);
};
