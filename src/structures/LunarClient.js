'use strict';

const { Client, Constants: { Events: { CLIENT_READY } } } = require('discord.js');
const { join, basename } = require('path');
const { getAllJsFiles } = require('../functions/files');
const DatabaseManager = require('./database/managers/DatabaseManager');
const LogHandler = require('./LogHandler');
const ChatBridgeArray = require('./chat_bridge/ChatBridgeArray');
const CommandCollection = require('./commands/CommandCollection');
const SlashCommandCollection = require('./commands/SlashCommandCollection');
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
		this.slashCommands = new SlashCommandCollection(this, join(__dirname, '..', 'slash_commands'));
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
		return this.chatBridge.minecraft.sendToChat.bind(this.chatBridge);
	}

	/**
	 * send to ingame guild chat via the main guild's chatBridge
	 * @type {Function}
	 */
	get gchat() {
		return this.chatBridge.minecraft.gchat.bind(this.chatBridge);
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
		return (async () => {
			try {
				const owner = await this.owner;
				return `${owner.tag} ${owner}`;
			} catch (error) {
				logger.error('[OWNER INFO]', error);
				return `<@${this.ownerID}>`;
			}
		})();
	}

	/**
	 * loads all commands, events, db caches and logs the client in
	 * @param {?string} token discord bot token
	 */
	async login(token) {
		await Promise.all([
			this.db.loadCache(),
			this.commands.loadAll(),
			this.slashCommands.loadAll(),
			this._loadEvents(),
		]);

		this.chatBridges.loadChannelIDs();

		return super.login(token);
	}

	/**
	 * sends a DM to the bot owner
	 * @param {string} message
	 */
	async dmOwner(message) {
		return (await this.owner).send(message, { split: { char: ' ' } });
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

			this[EVENT_NAME !== CLIENT_READY ? 'on' : 'once'](EVENT_NAME, event.bind(null, this));

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
