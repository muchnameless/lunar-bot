'use strict';

const { CronJob } = require('cron');
const ModelManager = require('./ModelManager');
const logger = require('../../../functions/logger');


module.exports = class CronJobManager extends ModelManager {
	constructor(options) {
		super(options);

		/**
		 * @type {import('discord.js').Collection<string, CronJob>}
		 */
		this.cache;
		/**
		 * @type {import('../models/CronJob')}
		 */
		this.model;
	}

	/**
	 * creates and starts a new cronJob
	 * @param {object} param0
	 * @param {string} param0.name
	 * @param {Date} param0.date
	 * @param {import('../../commands/SlashCommand')} param0.command
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

				try {
					const dbEntry = await this.model.findOne({ where: { name } });
					const message = await dbEntry.restoreCommandMessage();
					await command.run(message, args, flags);
					await this.model.destroy({ where: { name } });
					this.cache.delete(name);
				} catch (error) {
					logger.error(error);
				}
			},
			start: true,
		}));
	}

	/**
	 * Resolves a data entry to a data Object.
	 * @param {string|Object} idOrInstance The id or instance of something in this Manager
	 * @returns {?Object} An instance from this Manager
	 */
	resolve(idOrInstance) {
		if (idOrInstance instanceof CronJob) return idOrInstance;
		if (idOrInstance instanceof this.model) return this.cache.get(idOrInstance[this.primaryKey]) ?? null;
		if (typeof idOrInstance === 'string') return this.cache.get(idOrInstance) ?? null;
		return null;
	}

	/**
	 * stops and removes a cronJob
	 * @param {string|CronJob} instanceOrId
	 */
	async remove(instanceOrId) {
		/**
		 * @type {CronJob}
		 */
		const cronJob = this.resolve(instanceOrId);

		if (!cronJob) throw new Error(`[CRONJOB REMOVE]: invalid input: ${instanceOrId}`);

		cronJob.stop();

		const name = this.cache.findKey(x => x === cronJob);

		this.cache.delete(name);

		return this.model.destroy({ where: { name } });
	}

	/**
	 * resumes all cronJobs
	 */
	async resume() {
		return Promise.all(
			(await this.model.findAll()).map(async cronJob => cronJob.resume()),
		);
	}
};
