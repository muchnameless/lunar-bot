'use strict';

const { Client, Collection, MessageEmbed, SnowflakeUtil, DiscordAPIError, Constants } = require('discord.js');
const path = require('path');
const { promises: fs } = require('fs');
const { cleanLoggingEmbedString } = require('../functions/util');
const { getAllJsFiles } = require('../functions/files');
const DatabaseHandler = require('./database/DatabaseHandler');
const CommandCollection = require('./collections/CommandCollection');
const logger = require('../functions/logger');


class LunarClient extends Client {
	constructor(options = {}) {
		super(options);

		this.db = new DatabaseHandler({ client: this, db: options.db });
		this.webhook = null;
		this.ownerID = process.env.OWNER ?? null;
		this.logBufferPath = path.join(__dirname, '..', '..', 'log_buffer');

		// custom collections
		// /**
		//  * @type {CommandCollection<string, import('./Command')>}
		//  */
		this.commands = new CommandCollection(this);
		this.cooldowns = new Collection();
	}

	get bannedUsers() {
		return this.db.handlers.bannedUsers;
	}

	get config() {
		return this.db.handlers.config;
	}

	get cronJobs() {
		return this.db.handlers.cronJobs;
	}

	get hypixelGuilds() {
		return this.db.handlers.hypixelGuilds;
	}

	get players() {
		return this.db.handlers.players;
	}

	get taxCollectors() {
		return this.db.handlers.taxCollectors;
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
	 * starts and caches a cronJob
	 * @param {string} name
	 * @param {import('cron').CronJob} cronJob
	 */
	schedule(name, cronJob) {
		if (!cronJob.running) cronJob.start();

		this.cronJobs.cache.set(name, cronJob);
	}

	/**
	 * loads all commands, events, db caches and logs the client in
	 * @param {?string} token discord bot token
	 */
	async login(token) {
		await this.db.loadCache();

		this.commands.loadAll();
		this._loadEvents();

		return super.login(token);
	}

	/**
	 * fetches and caches the logging webhook and posts all remaining file logs from the log_buffer
	 */
	async initializeLoggingWebhook() {
		if (this.config.getBoolean('LOGGING_WEBHOOK_DELETED')) return logger.warn('[LOGGING WEBHOOK]: deleted');

		try {
			const loggingWebhook = await this.fetchWebhook(process.env.WEBHOOK_ID, process.env.WEBHOOK_TOKEN);

			if (!loggingWebhook) return;

			this.webhook = loggingWebhook;
			this._postFileLogs(); // repost webhook logs that failed to be posted during the last uptime
		} catch (error) {
			if (error instanceof DiscordAPIError && error.code === Constants.APIErrors.UNKNOWN_WEBHOOK) this.config.set('LOGGING_WEBHOOK_DELETED', 'true');
			logger.error(`[LOGGING WEBHOOK]: ${error.name}: ${error.message}`);
		}
	}

	/**
	 * logs the embeds to console and via the logging webhook
	 * @param {...MessageEmbed|string} embeds embeds to log
	 * @param {Promise<?import('./extensions/Message')>}
	 */
	async log(...embeds) {
		embeds = embeds.filter(x => x != null); // filter out null, undefined, ...

		if (!embeds.length) throw new TypeError('[CLIENT LOG]: cannot send an empty message');
		if (embeds.length > 10) throw new RangeError('[CLIENT LOG]: exceeded maximum embed count of 10');

		// log to console
		for (let embed of embeds) {
			if (typeof embed === 'string') {
				embed = embeds[embeds.indexOf(embed)] = new MessageEmbed({ color: this.config.get('EMBED_BLUE'), description: embed });
			} else if (typeof embed !== 'object' || !embed) {
				throw new TypeError(`[CLIENT LOG]: provided argument '${embed}' is a ${typeof embed} instead of an Object or String`);
			}

			const FIELDS_LOG = embed.fields?.filter(field => field.name !== '\u200b' || field.value !== '\u200b');

			logger.info([
				[ embed.title, cleanLoggingEmbedString(embed.description), embed.author?.name ].filter(x => x != null).join(': '),
				FIELDS_LOG?.length ? FIELDS_LOG.map(field => `${field.name !== '\u200b' ? `${field.name.replace(/\u200b/g, '').trim()}: ` : ''}${cleanLoggingEmbedString(field.value).replace(/\n/g, ', ')}`).join('\n') : null,
			].filter(x => x != null).join('\n'));
		}

		// no logging webhook
		if (!this.webhook) {
			logger.warn('[CLIENT LOG]: webhook unavailable');
			return this._logToFile(embeds.map(embed => JSON.stringify(embed)).join('\n'));
		}

		// API call
		try {
			const res = await this.webhook.send({
				username: `${this.user.username} Log`,
				avatarURL: this.user.displayAvatarURL(),
				embeds,
			});

			return res;
		} catch (error) {
			logger.error(`[CLIENT LOG]: ${error.name}: ${error.message}`);

			// webhook doesn't exist anymore
			if (error instanceof DiscordAPIError && error.code === Constants.APIErrors.UNKNOWN_WEBHOOK) {
				this.webhook = null;
				this.config.set('LOGGING_WEBHOOK_DELETED', 'true');
			}

			this._logToFile(embeds.map(embed => JSON.stringify(embed)).join('\n'));

			return null;
		}
	}

	/**
	 * create log_buffer folder if it is non-existent
	 */
	async _createLogBufferFolder() {
		return fs.mkdir(this.logBufferPath).then(
			() => logger.debug('[LOG BUFFER]: created \'log_buffer\' folder'),
			() => null,
		);
	}

	/**
	 * write data in 'cwd/log_buffer'
	 * @param {string} data file content
	 */
	async _logToFile(data) {
		try {
			await this._createLogBufferFolder();
			await fs.writeFile(
				path.join(this.logBufferPath, `${new Date().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}_${SnowflakeUtil.generate()}`),
				data,
			);
		} catch (error) {
			logger.error(`[LOG TO FILE]: ${error.name}: ${error.message}`);
		}
	}

	/**
	 * read all files from 'cwd/log_buffer' and webhook log their parsed content
	 */
	async _postFileLogs() {
		try {
			await this._createLogBufferFolder();

			const logBufferFiles = await fs.readdir(this.logBufferPath);

			if (!logBufferFiles) return;

			for (const file of logBufferFiles) {
				const FILE_PATH = path.join(this.logBufferPath, file);
				const FILE_CONTENT = await fs.readFile(FILE_PATH, 'utf8');

				await this.log(...FILE_CONTENT.split('\n').map(x => new MessageEmbed(JSON.parse(x))));
				await fs.unlink(FILE_PATH);
			}
		} catch (error) {
			logger.error(`[POST LOG FILES]: ${error.name}: ${error.message}`);
		}
	}

	/**
	 * loads all event-callbacks and binds them to their respective events
	 */
	_loadEvents() {
		const eventFiles = getAllJsFiles(path.join(__dirname, '..', 'events'));

		if (!eventFiles) return logger.warn('[EVENTS]: no event files');

		for (const file of eventFiles) {
			const event = require(file);
			const EVENT_NAME = path.basename(file, '.js');

			this[EVENT_NAME === Constants.Events.CLIENT_READY ? 'once' : 'on'](EVENT_NAME, event.bind(null, this));

			delete require.cache[require.resolve(file)];
		}

		logger.debug(`[EVENTS]: ${eventFiles.length} event${eventFiles.length !== 1 ? 's' : ''} loaded`);
	}

	/**
	 * space-padding at the beginning and '0'-padding at the end
	 * @param {number} number number to format
	 * @param {number} paddingAmount amount to space-pad at the start (default 2)
	 */
	formatDecimalNumber(number, paddingAmount = 2) {
		const NUMBER_ARRAY = number.toFixed(2).split('.');
		return `${Number(NUMBER_ARRAY[0]).toLocaleString(this.config.get('NUMBER_FORMAT')).padStart(paddingAmount, ' ')}.${NUMBER_ARRAY[1]}`;
	}

	/**
	 * space-padding at the beginning, converterFunction and locale string formatting
	 * @param {number} number number to format
	 * @param {number} paddingAmount amount to space-pad at the start (default 0)
	 * @param {Function} converterFunction function to be called on the number
	 */
	formatNumber(number, paddingAmount = 0, converterFunction = x => x) {
		return converterFunction(number).toLocaleString(this.config.get('NUMBER_FORMAT')).padStart(paddingAmount, ' ');
	}
}

module.exports = LunarClient;
