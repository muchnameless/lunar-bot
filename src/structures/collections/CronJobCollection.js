'use strict';

const { CronJob } = require('cron');
const { restoreMessage } = require('../../functions/util');
const logger = require('../../functions/logger');
const BaseClientCollection = require('./BaseClientCollection');


class CronJobCollection extends BaseClientCollection {
	constructor(client, entries = null) {
		super(client, entries);
	}

	async create({ name, date, command, authorID, messageID, channelID, args, flags }) {
		// create db entry
		await this.client.db.CronJob.create({
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
				command.execute(await restoreMessage(this, await this.client.db.CronJob.findOne({ where: { name } })), args, flags).catch(logger.error);
				this.delete(name);
				this.client.db.CronJob.destroy({ where: { name } });
				logger.info(`[CRONJOB]: ${name}`);
			},
			start: true,
		}));
	}
}

module.exports = CronJobCollection;
