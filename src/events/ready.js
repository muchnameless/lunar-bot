'use strict';

const { CronJob } = require('cron');
const Event = require('../structures/events/Event');
const logger = require('../functions/logger');


module.exports = class ReadyEvent extends Event {
	constructor(data) {
		super(data, {
			once: true,
			enabled: true,
		});
	}

	/**
	 * event listener callback
	 */
	async run() {
		logger.debug(`[READY]: logged in as ${this.client.user.tag}`);

		await this.client.logHandler.init();

		// Fetch all members for initially available guilds
		if (this.client.options.fetchAllMembers) {
			await Promise.all(this.client.guilds.cache.map(async (guild) => {
				if (!guild.available) return logger.warn(`[READY]: ${guild.name} not available`);

				try {
					await guild.members.fetch();
					logger.debug(`[READY]: ${guild.name}: fetched ${this.client.formatNumber(guild.memberCount)} members`);
				} catch (error) {
					logger.error(`[READY]: ${guild.name}: error fetching all members`, error);
				}
			}));
		}

		this.client.db.schedule();

		// set presence again every 20 min cause it get's lost sometimes
		this.client.setInterval(async () => {
			try {
				const presence = this.client.user.setPresence({
					activities: [{
						name: 'slash commands',
						type: 'LISTENING',
					}],
					status: 'online',
				});

				if (this.config.getBoolean('EXTENDED_LOGGING_ENABLED')) logger.info(`[SET PRESENCE]: activity set to ${presence.activities[0].name}`);
			} catch (error) {
				logger.error('[SET PRESENCE]: error while setting presence', error);
			}
		}, 20 * 60_000); // 20 min

		// schedule guild stats channel update
		this.client.schedule('guildStatsChannelUpdate', new CronJob({
			cronTime: '0 0 * * * *',
			async onTick() {
				if (!this.config.getBoolean('AVERAGE_STATS_CHANNEL_UPDATE_ENABLED')) return;

				const { mainGuild } = this.client.hypixelGuilds;

				if (!mainGuild) return;

				const { formattedStats } = mainGuild;

				if (!formattedStats) return;

				try {
					for (const type of [ 'weight', 'skill', 'slayer', 'catacombs' ]) {
					/**
					 * @type {import('discord.js').VoiceChannel}
					 */
						const channel = this.client.channels.cache.get(this.config.get(`${type}_AVERAGE_STATS_CHANNEL_ID`));

						if (!channel) continue; // no channel found

						const newName = `${type} avg: ${formattedStats[`${type}Average`]}`;
						const { name: oldName } = channel;

						if (newName === oldName) continue; // no update needed

						if (!channel.editable) {
							logger.error(`[GUILD STATS CHANNEL UPDATE]: ${channel.name}: missing permissions to edit`);
							continue;
						}

						await channel.setName(newName, `synced with ${mainGuild.name}'s average stats`);

						logger.info(`[GUILD STATS CHANNEL UPDATE]: '${oldName}' -> '${newName}'`);
					}
				} catch (error) {
					logger.error('[GUILD STATS CHANNEL UPDATE]', error);
				}
			},
			start: true,
		}));

		// chatBridges
		if (this.config.getBoolean('CHATBRIDGE_ENABLED')) await this.client.chatBridges.connect();

		// log ready
		logger.debug(`[READY]: startup complete. ${this.client.cronJobs.size} CronJobs running. Logging webhook available: ${this.client.logHandler.webhookAvailable}`);
	}
};
