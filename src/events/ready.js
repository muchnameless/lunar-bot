'use strict';

const { CronJob } = require('cron');
const logger = require('../functions/logger');


/**
 * error
 * @param {import('../structures/LunarClient')} client
 */
module.exports = async (client) => {
	logger.debug(`[READY]: logged in as ${client.user.tag}`);

	await client.logHandler.init();

	// TEMP
	const res = await client.commands.init(client.application.commands)
	logger.debug(res)
	// logger.debug(client.commands.map(c => [ c.name, c.dataLength ]))
	// TEMP

	// Fetch all members for initially available guilds
	if (client.options.fetchAllMembers) {
		await Promise.all(client.guilds.cache.map(async (guild) => {
			if (!guild.available) return logger.warn(`[READY]: ${guild.name} not available`);

			try {
				await guild.members.fetch();
				logger.debug(`[READY]: ${guild.name}: fetched ${guild.memberCount} members`);
			} catch (error) {
				logger.error(`[READY]: ${guild.name}: error fetching all members`, error);
			}
		}));
	}

	client.db.schedule();

	// set presence again every 20 min cause it get's lost sometimes
	client.setInterval(async () => {
		try {
			const presence = client.user.setPresence({
				activities: [{
					name: '/commands',
					type: 'LISTENING',
				}],
				status: 'online',
			});

			if (client.config.getBoolean('EXTENDED_LOGGING_ENABLED')) logger.info(`[SET PRESENCE]: activity set to ${presence.activities[0].name}`);
		} catch (error) {
			logger.error('[SET PRESENCE]: error while setting presence', error);
		}
	}, 20 * 60_000); // 20 min

	// schedule guild stats channel update
	client.schedule('guildStatsChannelUpdate', new CronJob({
		cronTime: '0 0 * * * *',
		async onTick() {
			if (!client.config.getBoolean('AVERAGE_STATS_CHANNEL_UPDATE_ENABLED')) return;

			const { mainGuild } = client.hypixelGuilds;

			if (!mainGuild) return;

			const { formattedStats } = mainGuild;

			if (!formattedStats) return;

			try {
				for (const type of [ 'weight', 'skill', 'slayer', 'catacombs' ]) {
				/**
				 * @type {import('discord.js').VoiceChannel}
				 */
					const channel = client.channels.cache.get(client.config.get(`${type}_AVERAGE_STATS_CHANNEL_ID`));

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
	if (client.config.getBoolean('CHATBRIDGE_ENABLED')) await client.chatBridges.connect();

	// log ready
	logger.debug(`[READY]: startup complete. ${client.cronJobs.size} CronJobs running. Logging webhook available: ${client.logHandler.webhookAvailable}`);
};
