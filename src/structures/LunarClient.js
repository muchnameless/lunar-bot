'use strict';

const { Client, Constants: { Events: { CLIENT_READY } } } = require('discord.js');
const { CronJob } = require('cron');
const { join, basename } = require('path');
const { getAllJsFiles } = require('../functions/files');
const { cleanFormattedNumber } = require('../functions/util');
const DatabaseManager = require('./database/managers/DatabaseManager');
const LogHandler = require('./LogHandler');
const ChatBridgeArray = require('./chat_bridge/ChatBridgeArray');
const CommandCollection = require('./commands/CommandCollection');
const logger = require('../functions/logger');


/**
 * @typedef {import('discord.js').ClientOptions} LunarClientOptions
 * @property {object} db
 */

class LunarClient extends Client {
	/**
	 * @param {LunarClientOptions} options
	 */
	constructor(options = {}) {
		super(options);

		this.ownerID = process.env.OWNER ?? null;
		this.db = new DatabaseManager({ client: this, db: options.db });
		this.logHandler = new LogHandler(this);
		this.chatBridges = new ChatBridgeArray(this);
		this.commands = new CommandCollection(this, join(__dirname, '..', 'commands'));
	}

	set webhook(value) {
		this.logHandler.webhook = value;
	}

	get webhook() {
		return this.logHandler.webhook;
	}

	get config() {
		return this.db.modelManagers.config;
	}

	get cronJobs() {
		return this.db.modelManagers.cronJobs;
	}

	get hypixelGuilds() {
		return this.db.modelManagers.hypixelGuilds;
	}

	get players() {
		return this.db.modelManagers.players;
	}

	get taxCollectors() {
		return this.db.modelManagers.taxCollectors;
	}

	/**
	 * returns the lunar guard discord guild
	 * @returns {?import('./extensions/Guild')} lunar guard discord guild
	 */
	get lgGuild() {
		const lgGuild = this.guilds.cache.get(this.config.get('DISCORD_GUILD_ID'));
		return lgGuild?.available ? lgGuild : logger.warn('discord guild is currently unavailable');
	}

	/**
	 * returns the logging webhook's channel
	 */
	get loggingChannel() {
		return this.channels.cache.get(this.webhook?.channelID) ?? null;
	}

	/**
	 * logs the embeds to console and via the logging webhook
	 * @type {Function(...embeds)}
	 * @param {...string|import('discord.js').MessageEmbed} embeds embeds to log
	 */
	get log() {
		return this.logHandler.log.bind(this.logHandler);
	}

	/**
	 * the main chatBridge
	 * @returns {import('./chat_bridge/ChatBridge')}
	 */
	get chatBridge() {
		return this.chatBridges[0];
	}

	/**
	 * the minecraft bot for the main guild's chatBridge
	 */
	get bot() {
		return this.chatBridge.bot;
	}

	/**
	 * send to ingame chat via the main guild's chatBridge
	 * @type {Function}
	 */
	get chat() {
		return this.chatBridge.sendToMinecraftChat.bind(this.chatBridge);
	}

	/**
	 * send to ingame guild chat via the main guild's chatBridge
	 * @type {Function}
	 */
	get gchat() {
		return this.chatBridge.gchat.bind(this.chatBridge);
	}

	/**
	 * send a message both to discord and the ingame guild chat
	 */
	get broadcast() {
		return this.chatBridge.broadcast.bind(this.chatBridge);
	}

	/**
	 * loads all commands, events, db caches and logs the client in
	 * @param {?string} token discord bot token
	 */
	async login(token) {
		await Promise.all([
			this.db.loadCache(),
			this.commands.loadAll(),
			this._loadEvents(),
		]);

		this.once(CLIENT_READY, this.onReady);

		return super.login(token);
	}

	/**
	 * initialize logging webhook, resume cronJobs, start renew presence interval
	 */
	async onReady() {
		logger.debug(`[READY]: logged in as ${this.user.tag}`);

		// Fetch all members for initially available guilds
		// if (this.options.fetchAllMembers) {
		// 	try {
		// 		const promises = this.guilds.cache.map(guild => guild.available ? guild.members.fetch().then(() => logger.debug(`[READY]: ${guild.name}: fetched all ${guild.memberCount} members`)) : Promise.resolve());
		// 		await Promise.all(promises);
		// 	} catch (error) {
		// 		logger.error(`Failed to fetch all members before ready! ${error}`);
		// 	}
		// }

		await this.logHandler.init();

		const { config, cronJobs } = this;

		this.db.schedule();

		// resume command cron jobs
		await cronJobs.resume().catch(logger.error);

		// set presence again every 20 min cause it get's lost sometimes
		this.setInterval(async () => {
			try {
				const presence = await this.user.setPresence({
					activity: {
						name: `${config.get('PREFIX')}help`,
						type: 'LISTENING',
					},
					status: 'online',
				});

				if (config.getBoolean('EXTENDED_LOGGING_ENABLED')) logger.info(`Activity set to ${presence.activities[0].name}`);
			} catch (error) {
				logger.error('error while setting activity:\n', error);
			}
		}, 20 * 60 * 1_000); // 20 min

		// schedule guild stats channel update
		this.schedule('guildStatsChannelUpdate', new CronJob({
			cronTime: '0 0 * * * *',
			onTick: async () => {
				if (!this.config.getBoolean('AVERAGE_STATS_CHANNEL_UPDATE_ENABLED')) return;

				const mainGuild = this.hypixelGuilds.cache.get(this.config.get('MAIN_GUILD_ID'));

				if (!mainGuild) return;

				const { stats } = mainGuild;

				if (!stats) return;

				try {
					for (const type of [ 'weight', 'skill', 'slayer', 'catacombs' ]) {
						/**
						 * @type {import('discord.js').VoiceChannel}
						 */
						const channel = this.channels.cache.get(this.config.get(`${type}_AVERAGE_STATS_CHANNEL_ID`));

						if (!channel) continue; // no channel found

						const newName = `${type} avg: ${cleanFormattedNumber(stats[`${type}Average`])}`;
						const { name: oldName } = channel;

						if (newName === oldName) continue; // no update needed

						if (!channel.editable) {
							logger.warn(`[GUILD STATS CHANNEL UPDATE]: ${channel.name}: missing permissions to edit`);
							continue;
						}

						await channel.setName(newName, `synced with ${mainGuild.name}'s average stats`);

						logger.info(`[GUILD STATS CHANNEL UPDATE]: '${oldName}' -> '${newName}'`);
					}
				} catch (error) {
					logger.error(`[GUILD STATS CHANNEL UPDATE]: ${error.name}: ${error.message}`);
				}
			},
			start: true,
		}));

		// chatBridges
		if (this.config.getBoolean('CHATBRIDGE_ENABLED')) await this.chatBridges.connect();

		// log ready
		logger.debug(`[READY]: startup complete. ${cronJobs.size} CronJobs running. Logging webhook available: ${this.logHandler.webhookAvailable}`);
	}

	/**
	 * starts and caches a cronJob
	 * @param {string} name
	 * @param {import('cron').CronJob} cronJob
	 */
	schedule(name, cronJob) {
		if (!cronJob.running) cronJob.start();

		this.cronJobs.cache.set(name, cronJob);
	}

	/**
	 * loads all event-callbacks and binds them to their respective events
	 */
	async _loadEvents() {
		const eventFiles = await getAllJsFiles(join(__dirname, '..', 'events'));

		for (const file of eventFiles) {
			const event = require(file);
			const EVENT_NAME = basename(file, '.js');

			this.on(EVENT_NAME, event.bind(null, this));

			delete require.cache[require.resolve(file)];
		}

		logger.debug(`[EVENTS]: ${eventFiles.length} event${eventFiles.length !== 1 ? 's' : ''} loaded`);
	}

	/**
	 * space-padding at the beginning and '0'-padding at the end
	 * @param {number} number number to format
	 * @param {number} [paddingAmount=0] amount to space-pad at the start
	 */
	formatDecimalNumber(number, paddingAmount = 0) {
		const NUMBER_ARRAY = number.toFixed(2).split('.');
		return `${Number(NUMBER_ARRAY[0]).toLocaleString(this.config.get('NUMBER_FORMAT')).padStart(paddingAmount, ' ')}.${NUMBER_ARRAY[1]}`;
	}

	/**
	 * space-padding at the beginning and '0'-padding at the end, returning no special chars
	 * @param {number} number number to format
	 * @param {number} [paddingAmount=0] amount to space-pad at the start
	 */
	formatDecimalNumberClean(...args) {
		return cleanFormattedNumber(this.formatDecimalNumber(...args));
	}

	/**
	 * space-padding at the beginning, converterFunction and locale string formatting
	 * @param {number} number number to format
	 * @param {number} paddingAmount amount to space-pad at the start (default 0)
	 * @param {Function} converterFunction function to be called on the number
	 * @returns {string}
	 */
	formatNumber(number, paddingAmount = 0, converterFunction = x => x) {
		return converterFunction(number).toLocaleString(this.config.get('NUMBER_FORMAT')).padStart(paddingAmount, ' ');
	}

	/**
	 * space-padding at the beginning, converterFunction and locale string formatting, returning no special chars
	 * @param {number} number number to format
	 * @param {number} paddingAmount amount to space-pad at the start (default 0)
	 * @param {Function} converterFunction function to be called on the number
	 * @returns {string}
	 */
	formatNumberClean(...args) {
		return cleanFormattedNumber(this.formatNumber(...args));
	}
}

module.exports = LunarClient;
