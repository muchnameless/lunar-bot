'use strict';

const { Model } = require('sequelize');
const LunarMessage = require('../../extensions/Message');
const logger = require('../../../functions/logger');


class CronJob extends Model {
	constructor(...args) {
		super(...args);

		/**
		 * @type {import('../../LunarClient')}
		 */
		this.client;
	}

	/**
	 * Helper method for defining associations.
	 * This method is not a part of Sequelize lifecycle.
	 * The `models/index` file will call this method automatically.
	 */
	static associate(models) {
		// define associations here
	}

	/**
	 * tries to fetch the cronJob's original command message and creates a mock message as replacement in case of an error
	 * @returns {Promise<LunarMessage>}
	 */
	async restoreCommandMessage() {
		const channel = await this.client.channels.fetch(this.channelID).catch(error => logger.error(`[CRON JOB RESUME]: channel: ${error.name}: ${error.message}`));
		const message = await channel?.messages.fetch(this.messageID).catch(error => logger.error(`[CRON JOB RESUME]: message: ${error.name}: ${error.message}`))
			?? new LunarMessage(this.client, {
				// mock 'data'
				id: this.messageID,
				channel,
				content: `${this.name}${this.flags?.length ? ` -${this.flags.join(' -')}` : ''}${this.args?.length ? ` ${this.args.join(' ')}` : ''}`,
				author: await this.client.users.fetch(this.authorID).catch(error => logger.error(`[CRON JOB RESUME]: user: ${error.name}: ${error.message}`)),
				guild: channel?.guild,
				member: await channel?.guild?.members.fetch(this.author).catch(error => logger.error(`[CRON JOB RESUME]: member: ${error.name}: ${error.message}`)) ?? null,
			}, channel);

		return message;
	}

	/**
	 * starts the cronJob or immediatly executes it if the scheduled time is in the past
	 */
	async resume() {
		// expired while bot was offline
		if (Date.now() > this.date - 10_000) { // -10_000 cause CronJob throws error if times are too close
			logger.info(`[CRONJOB]: ${this.name}`);
			this.client.cronJobs.model.destroy({ where: { name: this.name } });
			return this.client.commands.getByName(this.command).run(this.client, this.client.config, await this.restoreCommandMessage(), this.args?.split(' ') ?? [], this.flags?.split(' ') ?? []).catch(logger.error);
		}

		this.client.schedule(this.name, new CronJob({
			cronTime: new Date(this.date),
			onTick: async () => {
				logger.info(`[CRONJOB]: ${this.name}`);
				this.client.cronJobs.remove(this);
				this.client.commands.getByName(this.command).run(this.client, this.client.config, await this.restoreCommandMessage(), this.args?.split(' ') ?? [], this.flags?.split(' ') ?? []).catch(logger.error);
			},
			start: true,
		}));
	}
}

module.exports = CronJob;
