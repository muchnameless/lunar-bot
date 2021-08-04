'use strict';

const { Client, MessageEmbed } = require('discord.js');
const { join } = require('path');
const DatabaseManager = require('./database/managers/DatabaseManager');
const LogHandler = require('./LogHandler');
const CronJobManager = require('./CronJobManager');
const ChatBridgeArray = require('./chat_bridge/ChatBridgeArray');
const SlashCommandCollection = require('./commands/SlashCommandCollection');
const EventCollection = require('./events/EventCollection');
const ImgurClient = require('./ImgurClient');
const cache = require('../api/cache');
const logger = require('../functions/logger');


/**
 * @typedef {import('discord.js').ClientOptions & { db: Record<string, any> }} LunarClientOptions
 */

module.exports = class LunarClient extends Client {
	/**
	 * @param {LunarClientOptions} options
	 */
	constructor(options = {}) {
		super(options);

		/** @type {import('discord.js').Snowflake} */
		this.ownerId = process.env.OWNER ?? null;
		this.db = new DatabaseManager({ client: this, db: options.db });
		this.logHandler = new LogHandler(this, join(__dirname, '..', '..', 'log_buffer'));
		this.cronJobs = new CronJobManager(this);
		this.chatBridges = new ChatBridgeArray(this);
		this.commands = new SlashCommandCollection(this, join(__dirname, '..', 'commands'));
		this.events = new EventCollection(this, join(__dirname, '..', 'events'));
		this.imgur = new ImgurClient({ authorization: `Client-ID ${process.env.IMGUR_CLIENT_ID}` });
	}

	get config() {
		return this.db.modelManagers.config;
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

	get chatTriggers() {
		return this.db.modelManagers.chatTriggers;
	}

	/**
	 * default embed, blue border and current timestamp
	 */
	get defaultEmbed() {
		return new MessageEmbed({
			color: this.config.get('EMBED_BLUE'),
			timestamp: Date.now(),
		});
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
	 * returns the log channel
	 */
	get loggingChannel() {
		return this.logHandler.channel;
	}

	/**
	 * logs up to 10 embeds to console and via the log handler
	 */
	get log() {
		return (...args) => this.logHandler.log(...args);
	}

	/**
	 * starts and caches a cronJob
	 */
	get schedule() {
		return (name, cronJob) => this.cronJobs.schedule(name, cronJob);
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
	 * send to in game chat via the main guild's chatBridge
	 */
	get chat() {
		return arg => this.chatBridge.minecraft.sendToChat(arg);
	}

	/**
	 * send to in game guild chat via the main guild's chatBridge
	 */
	get gchat() {
		return arg => this.chatBridge.minecraft.gchat(arg);
	}

	/**
	 * send a message both to discord and the in game guild chat
	 */
	get broadcast() {
		return arg => this.chatBridge.broadcast(arg);
	}

	/**
	 * @returns {Promise<import('./extensions/User')>}
	 */
	get owner() {
		return this.users.fetch(this.ownerId);
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
				return `<@${this.ownerId}>`;
			}
		})();
	}

	/**
	 * loads all commands, events, db caches and logs the client in
	 * @param {?string} token discord bot token
	 */
	async login(token) {
		await this.db.init();

		// these need the db cache to be populated
		await Promise.all([
			this.commands.loadAll(),
			this.events.loadAll(),
			this.chatBridges.loadChannelIds(),
		]);

		try {
			return await super.login(token);
		} catch (error) {
			logger.error('[CLIENT LOGIN]', error);
			this.exit(1);
		}
	}

	/**
	 * sends a DM to the bot owner
	 * @param {string} content
	 */
	async dmOwner(content) {
		return (await this.owner).send({
			content,
			split: { char: ' ' },
		});
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
			]);

			if (output.some(({ status }) => status === 'rejected')) throw output;

			output = output.filter(({ reason }) => reason != null);

			if (output.length) console.log(output);

			process.exit(code);
		} catch (error) {
			console.error('[CLIENT EXIT]', error);
			process.exit(1);
		}
	}
};
