'use strict';

const { CronJob } = require('cron');
const { CronJob: cronJobDB } = require('../../../database/models/index');
const { restoreMessage } = require('../../functions/util');
const logger = require('../../functions/logger');
const BaseClientCollection = require('./BaseClientCollection');


class CronJobCollection extends BaseClientCollection {
	constructor(client, entries = null) {
		super(client, entries);
	}

	async create({ name, date, command, authorID, messageID, channelID, args, flags }) {
		// create db entry
		await cronJobDB.create({
			name,
			date: date.getTime(),
			command: command.name,
			authorID,
			messageID,
			channelID,
			args: args?.length ? args.join(' ') : null,
			flags: flags?.length ? flags.join(' ') : null,
		});

		// create cronJob
		this.set(name, new CronJob({
			cronTime: date,
			onTick: async () => {
				command.execute(await restoreMessage(this, await cronJobDB.findOne({ where: { name } })), args, flags).catch(logger.error);
				this.delete(name);
				cronJobDB.destroy({ where: { name } });
				logger.info(`[CRONJOB]: ${name}`);
			},
			start: true,
		}));
	}
}

module.exports = CronJobCollection;
