'use strict';

const { MessageEmbed, SnowflakeUtil, DiscordAPIError } = require('discord.js');
const { join } = require('path');
const { promises: fs } = require('fs');
const { cleanLoggingEmbedString } = require('../functions/util');
const logger = require('../functions/logger');


class LogHandler {
	/**
	 * @param {import('./LunarClient')} client
	 */
	constructor(client) {
		this.client = client;
		this.logBufferPath = join(__dirname, '..', '..', 'log_buffer');
		/**
		 * @type {import('discord.js').Webhook}
		 */
		this.webhook = null;
	}

	/**
	 * wether the logging webhook is properly loaded and cached
	 */
	get webhookAvailable() {
		return Boolean(this.webhook);
	}

	/**
	 * fetches and caches the logging webhook and posts all remaining file logs from the log_buffer
	 */
	async init() {
		if (this.client.config.getBoolean('LOGGING_WEBHOOK_DELETED')) return logger.warn('[LOGGING WEBHOOK]: deleted');

		try {
			const loggingWebhook = await this.client.fetchWebhook(process.env.LOGGING_WEBHOOK_ID, process.env.LOGGING_WEBHOOK_TOKEN);

			this.webhook = loggingWebhook;
			this._postFileLogs(); // repost webhook logs that failed to be posted during the last uptime
		} catch (error) {
			if (error instanceof DiscordAPIError && error.method === 'get' && error.code === 0 && error.httpStatus === 404) this.client.config.set('LOGGING_WEBHOOK_DELETED', 'true');
			logger.error(`[LOGGING WEBHOOK]: ${error.name}: ${error.message}`);
		}
	}

	/**
	 * logs the embeds to console and via the logging webhook
	 * @param {...MessageEmbed|string} embeds embeds to log
	 */
	async log(...embeds) {
		embeds = embeds.filter(x => x != null); // filter out null, undefined, ...

		if (!embeds.length) throw new TypeError('[CLIENT LOG]: cannot send an empty message');
		if (embeds.length > 10) throw new RangeError('[CLIENT LOG]: exceeded maximum embed count of 10');

		// log to console
		for (let embed of embeds) {
			if (typeof embed === 'string') {
				embed = embeds[embeds.indexOf(embed)] = new MessageEmbed({ color: this.client.config.get('EMBED_BLUE'), description: embed });
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
				username: `${this.client.user.username} Log`,
				avatarURL: this.client.user.displayAvatarURL(),
				embeds,
			});

			return res;
		} catch (error) {
			logger.error(`[CLIENT LOG]: ${error.name}: ${error.message}`);

			// webhook doesn't exist anymore
			if (error instanceof DiscordAPIError && error.method === 'get' && error.code === 0 && error.httpStatus === 404) {
				this.webhook = null;
				this.client.config.set('LOGGING_WEBHOOK_DELETED', 'true');
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
			() => null, // rejects if folder already exists
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
				join(this.logBufferPath, `${new Date().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(', ', '_').replace(/:/g, '.')}_${SnowflakeUtil.generate()}`),
				data,
			);
		} catch (error) {
			logger.error(error);
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
				const FILE_PATH = join(this.logBufferPath, file);
				const FILE_CONTENT = await fs.readFile(FILE_PATH, 'utf8');

				await this.log(...FILE_CONTENT.split('\n').map(x => new MessageEmbed(JSON.parse(x))));
				await fs.unlink(FILE_PATH);
			}
		} catch (error) {
			logger.error(`[POST LOG FILES]: ${error.name}: ${error.message}`);
		}
	}
}

module.exports = LogHandler;
