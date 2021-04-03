'use strict';

const { Model, DataTypes } = require('sequelize');
const { CronJob: CronJobConstructor } = require('cron');
const LunarMessage = require('../../extensions/Message');
const logger = require('../../../functions/logger');


module.exports = class CronJob extends Model {
	constructor(...args) {
		super(...args);

		/**
		 * @type {import('../../LunarClient')}
		 */
		this.client;
		/**
		 * @type {string}
		 */
		this.name;
		/**
		 * @type {number}
		 */
		this.date;
		/**
		 * @type {string}
		 */
		this.command;
		/**
		 * @type {string}
		 */
		this.authorID;
		/**
		 * @type {string}
		 */
		this.messageID;
		/**
		 * @type {string}
		 */
		this.channelID;
		/**
		 * @type {?string[]}
		 */
		this.args;
		/**
		 * @type {?string[]}
		 */
		this.flags;
	}

	/**
	 * @param {import('sequelize')} sequelize
	 */
	static init(sequelize) {
		return super.init({
			name: {
				type: DataTypes.TEXT,
				primaryKey: true,
			},
			date: {
				type: DataTypes.BIGINT,
				allowNull: false,
			},
			command: {
				type: DataTypes.TEXT,
				allowNull: false,
			},
			authorID: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			messageID: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			channelID: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			args: {
				type: DataTypes.TEXT,
				allowNull: true,
			},
			flags: {
				type: DataTypes.TEXT,
				allowNull: true,
			},
		}, {
			sequelize,
			modelName: 'CronJob',
			timestamps: false,
		});
	}

	/**
	 * tries to fetch the cronJob's original command message and creates a mock message as replacement in case of an error
	 * @returns {Promise<LunarMessage>}
	 */
	async restoreCommandMessage() {
		const channel = await this.client.channels.fetch(this.channelID).catch(error => logger.error(`[CRON JOB RESUME]: channel: ${error}`));
		const message = await channel?.messages.fetch(this.messageID).catch(error => logger.error(`[CRON JOB RESUME]: message: ${error}`))
			?? new LunarMessage(this.client, {
				// mock 'data'
				id: this.messageID,
				channel,
				content: `${this.name}${this.flags?.length ? ` -${this.flags.join(' -')}` : ''}${this.args?.length ? ` ${this.args.join(' ')}` : ''}`,
				author: await this.client.users.fetch(this.authorID).catch(error => logger.error(`[CRON JOB RESUME]: user: ${error}`)),
				guild: channel?.guild,
				member: await channel?.guild?.members.fetch(this.author).catch(error => logger.error(`[CRON JOB RESUME]: member: ${error}`)) ?? null,
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

			try {
				return await this.client.commands.getByName(this.command).run(await this.restoreCommandMessage(), this.args?.split(' ') ?? [], this.flags?.split(' ') ?? []);
			} catch (error) {
				return logger.error(error);
			} finally {
				this.client.cronJobs.model.destroy({ where: { name: this.name } });
			}
		}

		this.client.schedule(this.name, new CronJobConstructor({
			cronTime: new Date(this.date),
			onTick: async () => {
				logger.info(`[CRONJOB]: ${this.name}`);
				this.client.cronJobs.remove(this);
				this.client.commands
					.getByName(this.command)
					.run(await this.restoreCommandMessage(), this.args?.split(' ') ?? [], this.flags?.split(' ') ?? [])
					.catch(logger.error);
			},
			start: true,
		}));
	}
};
