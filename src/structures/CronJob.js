'use strict';

const { Model } = require('sequelize');
const logger = require('../functions/logger');


class CronJob extends Model {
	constructor(...args) {
		super(...args);
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
	 */
	async restoreCommandMessage() {
		const channel = await this.client.channels.fetch(this.channelID).catch(error => logger.error(`[CRON JOB RESUME]: channel: ${error.name}: ${error.message}`));
		const message = await channel?.messages.fetch(this.messageID).catch(error => logger.error(`[CRON JOB RESUME]: message: ${error.name}: ${error.message}`))
			?? new require('../structureExtensions/lib/Message')(this.client, {
				// mock 'data'
				id: this.messageID,
				channel: channel,
				content: `${this.name}${this.flags?.length ? ` -${this.flags.join(' -')}` : ''}${this.args?.length ? ` ${this.args.join(' ')}` : ''}`,
				author: await this.client.users.fetch(this.authorID).catch(error => logger.error(`[CRON JOB RESUME]: user: ${error.name}: ${error.message}`)),
				guild: channel?.guild,
				member: await this.guild?.members.fetch(this.author).catch(error => logger.error(`[CRON JOB RESUME]: member: ${error.name}: ${error.message}`)) ?? null,
			}, channel);

		return message;
	}
}

module.exports = CronJob;
