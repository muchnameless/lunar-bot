'use strict';

const { CronJob } = require('cron');
const ModelHandler = require('./ModelHandler');
const logger = require('../../functions/logger');


class CronJobHandler extends ModelHandler {
	constructor(options) {
		super(options);

		/**
		 * @type {import('discord.js').Collection<string, import('./models/CronJob')}
		 */
		this.cache;
		/**
		 * @type {import('./models/CronJob')}
		 */
		this.model;
	}

	/**
	 * creates and starts a new cronJob
	 * @param {object} param0
	 * @param {string} param0.name
	 * @param {Date} param0.date
	 * @param {string} param0.authorID
	 * @param {string} param0.messageID
	 * @param {string} param0.channelID
	 * @param {string[]} param0.args
	 * @param {string[]} param0.flags
	 */
	async add({ name, date, command, authorID, messageID, channelID, args, flags }) {
		// create db entry
		await this.model.create({
			name,
			date: date.getTime(),
			command: command.name,
			authorID,
			messageID,
			channelID,
			args: args?.length ? args.join(' ') : null,
			flags: flags?.length ? flags.join(' ') : null,
		});

		// create cronJob and add to collection
		this.cache.set(name, new CronJob({
			cronTime: date,
			onTick: async () => {
				logger.info(`[CRONJOB]: ${name}`);
				command.run(this.client, this.client.config, await (await this.model.findOne({ where: { name } })).restoreCommandMessage(), args, flags).catch(logger.error);
				this.cache.delete(name);
				this.model.destroy({ where: { name } });
			},
			start: true,
		}));
	}

	/**
	 * stops and removes a cronJob
	 * @param {string|import('./models/CronJob')} instanceOrId
	 */
	async remove(instanceOrId) {
		const cronJob = this.resolve(instanceOrId);

		if (!cronJob) throw new Error(`[CRONJOB REMOVE]: invalid input: ${instanceOrId}`);

		cronJob.stop();

		return super.remove(cronJob);
	}

	/**
	 * resumes all cronJobs
	 */
	async resume() {
		return Promise.all(
			(await this.model.findAll()).map(async cronJob => cronJob.resume()),
		);
	}
}

module.exports = CronJobHandler;
