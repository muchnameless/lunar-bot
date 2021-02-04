'use strict';

const { MessageEmbed } = require('discord.js');
const { CronJob } = require('cron');
const { MAYOR_CHANGE_INTERVAL } = require('../constants/skyblock');
const { offsetFlags } = require('../constants/database');


const self = module.exports = {

	startCompetition: client => {
		const { config } = client;

		client.players.resetXp({ offsetToReset: offsetFlags.COMPETITION_START });
		config.set('COMPETITION_RUNNING', 'true');
		config.set('COMPETITION_SCHEDULED', 'false');
		client.log(new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
			.setTitle('Guild Competition')
			.setDescription('started')
			.setTimestamp(),
		);
	},

	endCompetition: client => {
		const { config } = client;

		client.players.resetXp({ offsetToReset: offsetFlags.COMPETITION_END });
		config.set('COMPETITION_RUNNING', 'false');
		client.log(new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
			.setTitle('Guild Competition')
			.setDescription('ended')
			.setTimestamp(),
		);
	},

	performMayorReset: client => {
		const { config } = client;
		const CURRENT_MAYOR_TIME = config.getNumber('LAST_MAYOR_XP_RESET_TIME') + MAYOR_CHANGE_INTERVAL;

		config.set('LAST_MAYOR_XP_RESET_TIME', CURRENT_MAYOR_TIME);
		client.players.resetXp({ offsetToReset: offsetFlags.MAYOR });
		client.log(new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
			.setTitle('Current Mayor XP Tracking')
			.setDescription(`reset the xp gained from all ${client.players.size} guild members`)
			.setTimestamp(),
		);

		client.cronJobs.set('mayorXpReset', new CronJob({
			cronTime: new Date(CURRENT_MAYOR_TIME + MAYOR_CHANGE_INTERVAL),
			onTick: () => self.performMayorReset(client),
			start: true,
		}));
	},

	performDailyReset: client => {
		const { config } = client;

		config.set('LAST_DAILY_XP_RESET_TIME', Date.now());
		client.players.resetXp({ offsetToReset: 'day' });
		client.log(new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
			.setTitle('Daily XP Tracking')
			.setDescription(`reset the xp gained from all ${client.players.size} guild members`)
			.setTimestamp(),
		);
	},

	performWeeklyReset: client => {
		const { config } = client;

		config.set('LAST_WEEKLY_XP_RESET_TIME', Date.now());
		client.players.resetXp({ offsetToReset: offsetFlags.WEEK });
		client.log(new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
			.setTitle('Weekly XP Tracking')
			.setDescription(`reset the xp gained from all ${client.players.size} guild members`)
			.setTimestamp(),
		);
	},

	performMonthlyReset: client => {
		const { config } = client;

		config.set('LAST_MONTHLY_XP_RESET_TIME', Date.now());
		client.players.resetXp({ offsetToReset: offsetFlags.MONTH });
		client.log(new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
			.setTitle('Monthly XP Tracking')
			.setDescription(`reset the xp gained from all ${client.players.size} guild members`)
			.setTimestamp(),
		);
	},

};
