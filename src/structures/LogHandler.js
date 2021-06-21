'use strict';

const { MessageEmbed, SnowflakeUtil, DiscordAPIError } = require('discord.js');
const { join } = require('path');
const { promises: { mkdir, writeFile, readdir, readFile, unlink } } = require('fs');
const { EMBED_MAX_CHARS, EMBEDS_PER_WH_MESSAGE } = require('../constants/discord');
const logger = require('../functions/logger');


module.exports = class LogHandler {
	/**
	 * @param {import('./LunarClient')} client
	 */
	constructor(client) {
		this.client = client;
		/**
		 * @type {import('discord.js').Webhook}
		 */
		this.webhook = null;
	}

	static LOG_PATH = join(__dirname, '..', '..', 'log_buffer');

	/**
	 * cleans a string from an embed for console logging
	 * @param {string} string the string to clean
	 */
	static cleanLoggingEmbedString(string) {
		return typeof string === 'string'
			? string
				.replace(/```(?:js|diff|cs|ada|undefined)?\n/g, '') // code blocks
				.replace(/`|\*|\n?\u200b|\\(?=_)/g, '') // inline code blocks, discord formatting, escaped '_'
				.replace(/\n{2,}/g, '\n') // consecutive line-breaks
			: null;
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
			logger.error('[LOGGING WEBHOOK]', error);
		}
	}

	/**
	 * logs an unspecified amount of embeds to console and via the logging webhook
	 * @param {MessageEmbed[]|string[]} embedsInput embeds to log
	 */
	async logMany(embedsInput) {
		const embeds = this._prepareEmbeds(embedsInput);
		const TOTAL_AMOUNT = embeds.length;
		const returnValue = [];

		for (let total = 0; total < TOTAL_AMOUNT; ++total) {
			const embedChunk = [];

			let embedChunkLength = 0;

			for (let current = 0; current < EMBEDS_PER_WH_MESSAGE && total < TOTAL_AMOUNT; ++current, ++total) {
				embedChunkLength += embeds[total].length;

				// adding the new embed would exceed the max char count
				if (embedChunkLength > EMBED_MAX_CHARS) {
					--total;
					break;
				}

				embedChunk.push(embeds[total]);
			}

			returnValue.push(this._sendViaWebhook(embedChunk));
		}

		return Promise.all(returnValue);
	}

	/**
	 * logs up to 10 embeds to console and via the logging webhook
	 * @param {...MessageEmbed} embedsInput embeds to log
	 */
	async log(...embedsInput) {
		return this._sendViaWebhook(this._prepareEmbeds(embedsInput));
	}

	/**
	 * make sure all elements are instances of MessageEmbed
	 * @param {MessageEmbed[]|string[]} embedsInput
	 */
	_prepareEmbeds(embedsInput) {
		const embeds = embedsInput.filter(x => x != null); // filter out null & undefined

		// make sure all elements in embeds are instances of MessageEmbed
		for (const [ index, embed ] of embeds.entries()) {
			if (embed instanceof MessageEmbed) continue;

			if (typeof embed === 'string') {
				embeds[index] = this.client.defaultEmbed.setDescription(embed);
				continue;
			}

			if (typeof embed !== 'object') {
				throw new TypeError(`[CLIENT LOG MANY]: provided argument '${embed}' is a ${typeof embed} instead of an Object or String`);
			}

			embeds[index] = new MessageEmbed(embed);
		}

		if (!embeds.length) throw new TypeError('[CLIENT LOG MANY]: cannot send an empty message');

		return embeds;
	}

	/**
	 * log to console and send via webhook
	 * @param {MessageEmbed[]} embedsInput
	 */
	async _sendViaWebhook(embeds) {
		// log to console
		for (const embed of embeds) {
			const FIELDS_LOG = embed.fields?.filter(({ name, value }) => name !== '\u200b' || value !== '\u200b');

			logger.info([
				[
					embed.title,
					LogHandler.cleanLoggingEmbedString(embed.description),
					embed.author?.name,
				].filter(x => x != null).join(': '),
				FIELDS_LOG?.length
					? FIELDS_LOG
						.map(({ name, value }) => `${name !== '\u200b' ? `${name.replace(/\u200b/g, '').trim()}: ` : ''}${LogHandler.cleanLoggingEmbedString(value).replace(/\n/g, ', ')}`)
						.join('\n')
					: null,
			]
				.filter(x => x != null)
				.join('\n'),
			);
		}

		// no logging webhook
		if (!this.webhook) {
			logger.warn('[CLIENT LOG]: webhook unavailable');
			return this._logToFile(embeds.map(embed => JSON.stringify(embed)).join('\n'));
		}

		// API call
		try {
			return await this.webhook.send({
				username: `${this.client.user.username} Log`,
				avatarURL: this.client.user.displayAvatarURL(),
				embeds,
			});
		} catch (error) {
			logger.error('[CLIENT LOG]', error);

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
	async _createLogBufferFolder() { // eslint-disable-line class-methods-use-this
		try {
			await mkdir(LogHandler.LOG_PATH);
			logger.debug('[LOG BUFFER]: created \'log_buffer\' folder');
			return true;
		} catch { // rejects if folder already exists
			return false;
		}
	}

	/**
	 * write data in 'cwd/log_buffer'
	 * @param {string} data file content
	 */
	async _logToFile(data) {
		try {
			await this._createLogBufferFolder();
			await writeFile(
				join(LogHandler.LOG_PATH, `${new Date()
					.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
					.replace(', ', '_')
					.replace(/:/g, '.')
				}_${SnowflakeUtil.generate()}`),
				data,
			);
		} catch (error) {
			logger.error(error);
			logger.error('[LOG TO FILE]', error);
		}
	}

	/**
	 * read all files from 'cwd/log_buffer' and webhook log their parsed content
	 */
	async _postFileLogs() {
		try {
			await this._createLogBufferFolder();

			const logBufferFiles = await readdir(LogHandler.LOG_PATH);

			if (!logBufferFiles) return;

			for (const file of logBufferFiles) {
				const FILE_PATH = join(LogHandler.LOG_PATH, file);
				const FILE_CONTENT = await readFile(FILE_PATH, 'utf8');

				await this.log(...FILE_CONTENT.split('\n').map(x => new MessageEmbed(JSON.parse(x))));
				await unlink(FILE_PATH);
			}
		} catch (error) {
			logger.error('[POST LOG FILES]', error);
		}
	}
};
