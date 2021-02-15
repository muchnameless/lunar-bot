'use strict';

const { MessageEmbed } = require('discord.js');
const { CronJob } = require('cron');
const { MAYOR_CHANGE_INTERVAL } = require('../constants/skyblock');
const { offsetFlags } = require('../constants/database');
const logger = require('./logger');


const self = module.exports = {

	/**
	 * resets competitionStart xp, updates the config and logs the event
	 * @param {import('../structures/LunarClient')} client
	 */
	startCompetition: client => {
		const { config, players } = client;

		players.resetXp({ offsetToReset: offsetFlags.COMPETITION_START });
		config.set('COMPETITION_RUNNING', 'true');
		config.set('COMPETITION_SCHEDULED', 'false');
		client.log(new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
			.setTitle('Guild Competition')
			.setDescription('started')
			.setTimestamp(),
		);
	},

	/**
	 * resets competitionEnd xp, updates the config and logs the event
	 * @param {import('../structures/LunarClient')} client
	 */
	endCompetition: client => {
		const { config, players } = client;

		players.resetXp({ offsetToReset: offsetFlags.COMPETITION_END });
		config.set('COMPETITION_RUNNING', 'false');
		client.log(new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
			.setTitle('Guild Competition')
			.setDescription('ended')
			.setTimestamp(),
		);
	},

	/**
	 * resets offsetMayor xp, updates the config and logs the event
	 * @param {import('../structures/LunarClient')} client
	 */
	performMayorReset: client => {
		const { config, players } = client;
		const CURRENT_MAYOR_TIME = config.getNumber('LAST_MAYOR_XP_RESET_TIME') + MAYOR_CHANGE_INTERVAL;

		config.set('LAST_MAYOR_XP_RESET_TIME', CURRENT_MAYOR_TIME);
		players.resetXp({ offsetToReset: offsetFlags.MAYOR });
		client.log(new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
			.setTitle('Current Mayor XP Tracking')
			.setDescription(`reset the xp gained from all ${players.size} guild members`)
			.setTimestamp(),
		);

		client.cronJobs.cache.set('mayorXpReset', new CronJob({
			cronTime: new Date(CURRENT_MAYOR_TIME + MAYOR_CHANGE_INTERVAL),
			onTick: () => self.performMayorReset(client),
			start: true,
		}));
	},

	/**
	 * shifts the daily xp array, updates the config and logs the event
	 * @param {import('../structures/LunarClient')} client
	 */
	performDailyReset: client => {
		const { config, players } = client;

		config.set('LAST_DAILY_XP_RESET_TIME', Date.now());
		players.resetXp({ offsetToReset: 'day' });
		client.log(new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
			.setTitle('Daily XP Tracking')
			.setDescription(`reset the xp gained from all ${players.size} guild members`)
			.setTimestamp(),
		);
	},

	/**
	 * resets offsetWeek xp, updates the config and logs the event
	 * @param {import('../structures/LunarClient')} client
	 */
	performWeeklyReset: client => {
		const { config, players } = client;

		config.set('LAST_WEEKLY_XP_RESET_TIME', Date.now());
		players.resetXp({ offsetToReset: offsetFlags.WEEK });
		client.log(new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
			.setTitle('Weekly XP Tracking')
			.setDescription(`reset the xp gained from all ${players.size} guild members`)
			.setTimestamp(),
		);
	},

	/**
	 * resets offsetMonth xp, updates the config and logs the event
	 * @param {import('../structures/LunarClient')} client
	 */
	performMonthlyReset: client => {
		const { config, players } = client;

		config.set('LAST_MONTHLY_XP_RESET_TIME', Date.now());
		players.resetXp({ offsetToReset: offsetFlags.MONTH });
		client.log(new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
			.setTitle('Monthly XP Tracking')
			.setDescription(`reset the xp gained from all ${players.size} guild members`)
			.setTimestamp(),
		);
	},

};
