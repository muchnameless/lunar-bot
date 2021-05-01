'use strict';

const { Client, Constants: { Events: { CLIENT_READY } } } = require('discord.js');
const { CronJob } = require('cron');
const { join, basename } = require('path');
const { getAllJsFiles } = require('../functions/files');
const DatabaseManager = require('./database/managers/DatabaseManager');
const LogHandler = require('./LogHandler');
const ChatBridgeArray = require('./chat_bridge/ChatBridgeArray');
const CommandCollection = require('./commands/CommandCollection');
const RedisListener = require('./RedisListener');
const cache = require('../api/cache');
const logger = require('../functions/logger');


/**
 * @typedef {import('discord.js').ClientOptions} LunarClientOptions
 * @property {object} db
 */

module.exports = class LunarClient extends Client {
	/**
	 * @param {LunarClientOptions} options
	 */
	constructor(options = {}) {
		super(options);

		this.ownerID = process.env.OWNER ?? null;
		this.db = new DatabaseManager({ client: this, db: options.db });
		this.logHandler = new LogHandler(this);
		this.chatBridges = new ChatBridgeArray(this);
		this.commands = new CommandCollection(this, join(__dirname, '..', 'commands'), true);
		this.redisListener = new RedisListener(this, process.env.REDIS_URI);
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
	 * logs up to 10 embeds to console and via the logging webhook
	 * @type {Function(...embeds)}
	 * @param {...string|import('discord.js').MessageEmbed} embeds embeds to log
	 */
	get log() {
		return this.logHandler.log.bind(this.logHandler);
	}

	/**
	 * logs an unspecified amount of embeds to console and via the logging webhook
	 * @type {Function(...embeds)}
	 * @param {...string|import('discord.js').MessageEmbed} embeds embeds to log
	 */
	get logMany() {
		return this.logHandler.logMany.bind(this.logHandler);
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
	 * @returns {Promise<import('./extensions/User')>}
	 */
	get owner() {
		return this.users.fetch(this.ownerID);
	}

	/**
	 * tag and @mention
	 */
	get ownerInfo() {
		return this.owner.then(
			owner => `${owner.tag} ${owner}`,
			() => `<@${this.ownerID}>`,
		);
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

		this.db.schedule();

		// resume command cron jobs
		await this.cronJobs.resume().catch(logger.error);

		// set presence again every 20 min cause it get's lost sometimes
		this.setInterval(async () => {
			try {
				const presence = await this.user.setPresence({
					activity: {
						name: `${this.config.get('PREFIX')}help`,
						type: 'LISTENING',
					},
					status: 'online',
				});

				if (this.config.getBoolean('EXTENDED_LOGGING_ENABLED')) logger.info(`[SET PRESENCE]: activity set to ${presence.activities[0].name}`);
			} catch (error) {
				logger.error(`[SET PRESENCE]: error while setting presence: ${error}`);
			}
		}, 20 * 60_000); // 20 min

		// schedule guild stats channel update
		this.schedule('guildStatsChannelUpdate', new CronJob({
			cronTime: '0 0 * * * *',
			onTick: async () => {
				if (!this.config.getBoolean('AVERAGE_STATS_CHANNEL_UPDATE_ENABLED')) return;

				const { mainGuild } = this.hypixelGuilds;

				if (!mainGuild) return;

				const { formattedStats } = mainGuild;

				if (!formattedStats) return;

				try {
					for (const type of [ 'weight', 'skill', 'slayer', 'catacombs' ]) {
						/**
						 * @type {import('discord.js').VoiceChannel}
						 */
						const channel = this.channels.cache.get(this.config.get(`${type}_AVERAGE_STATS_CHANNEL_ID`));

						if (!channel) continue; // no channel found

						const newName = `${type} avg: ${formattedStats[`${type}Average`]}`;
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
					logger.error(`[GUILD STATS CHANNEL UPDATE]: ${error}`);
				}
			},
			start: true,
		}));

		// chatBridges
		if (this.config.getBoolean('CHATBRIDGE_ENABLED')) await this.chatBridges.connect();

		// log ready
		logger.debug(`[READY]: startup complete. ${this.cronJobs.size} CronJobs running. Logging webhook available: ${this.logHandler.webhookAvailable}`);
	}

	/**
	 * sends a DM to the bot owner
	 * @param {string} message
	 */
	async dmOwner(message) {
		return await (await this.owner).send(message, { split: { char: ' ' } });
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
		if (Number.isNaN(number)) return 'NaN'.padStart(paddingAmount, ' ');

		const [ BEFORE_DOT, AFTER_DOT ] = number.toFixed(2).split('.');

		return `${Number(BEFORE_DOT)
			.toLocaleString(this.config.get('NUMBER_FORMAT'))
			.padStart(paddingAmount, ' ')
		}.${AFTER_DOT}`;
	}

	/**
	 * space-padding at the beginning, converterFunction and locale string formatting
	 * @param {number} number number to format
	 * @param {number} paddingAmount amount to space-pad at the start (default 0)
	 * @param {Function} converterFunction function to be called on the number
	 * @returns {string}
	 */
	formatNumber(number, paddingAmount = 0, converterFunction = x => x) {
		return converterFunction(number)
			.toLocaleString(this.config.get('NUMBER_FORMAT'))
			.replace(',', '.')
			.padStart(paddingAmount, ' ');
	}

	/**
	 * closes all db connections and exits the process
	 * @param {number} code exit code
	 */
	async exit(code = 0) {
		try {
			let output = await Promise.allSettled([
				this.db.sequelize.close(),
				cache.opts.store.redis.quit(),
				this.redisListener.redis.quit(),
			]);

			if (output.some(({ status }) => status === 'rejected')) throw output;

			output = output.filter(({ reason }) => reason != null);

			if (output.length) console.log(output);

			process.exit(code);
		} catch (error) {
			console.error(error);
			process.exit(1);
		}
	}
};
