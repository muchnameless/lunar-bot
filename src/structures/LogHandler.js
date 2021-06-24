'use strict';

const { Permissions, MessageEmbed, SnowflakeUtil } = require('discord.js');
const { commaListsAnd } = require('common-tags');
const { promises: { mkdir, writeFile, readdir, readFile, unlink } } = require('fs');
const { join } = require('path');
const { EMBED_MAX_CHARS, EMBEDS_PER_WH_MESSAGE } = require('../constants/discord');
const logger = require('../functions/logger');


module.exports = class LogHandler {
	/**
	 * @param {import('./LunarClient')} client
	 * @param {string} logPath
	 */
	constructor(client, logPath) {
		this.client = client;
		this.logPath = logPath;
	}

	static REQUIRED_CHANNEL_PERMISSIONS = Permissions.FLAGS.VIEW_CHANNEL | Permissions.FLAGS.SEND_MESSAGES | Permissions.FLAGS.EMBED_LINKS;

	/**
	 * cleans a string from an embed for console logging
	 * @param {string} string the string to clean
	 */
	static cleanLoggingEmbedString(string) {
		if (typeof string === 'string') return string
			.replace(/```(?:js|diff|cs|ada|undefined)?\n/g, '') // code blocks
			.replace(/`|\*|\n?\u200b|\\(?=_)/g, '') // inline code blocks, discord formatting, escaped '_'
			.replace(/\n{2,}/g, '\n'); // consecutive line-breaks

		return null;
	}

	/**
	 * logging channel
	 */
	get channel() {
		const channel = this.client.channels.cache.get(this.client.config.get('LOGGING_CHANNEL_ID'));

		if (!channel?.isText()) return logger.error(`[LOG HANDLER]: ${channel ? `#${channel.name}` : this.client.config.get('LOGGING_CHANNEL_ID')} is not a cached text based channel (id)`);

		if (!channel.botPermissions.has(LogHandler.REQUIRED_CHANNEL_PERMISSIONS)) {
			return logger.error(commaListsAnd`[LOG HANDLER]: missing ${channel.botPermissions.missing(LogHandler.REQUIRED_CHANNEL_PERMISSIONS).map(permission => `'${permission}'`)}`);
		}

		return channel;
	}

	/**
	 * wether the log handler has a valid channel with all neccessary permissions
	 */
	get ready() {
		return Boolean(this.channel);
	}

	/**
	 * posts all remaining file logs from the log_buffer
	 */
	async init() {
		const { channel } = this;

		if (!channel) return;

		try {
			return await this._postFileLogs(); // repost logs that failed to be posted during the last uptime
		} catch (error) {
			logger.error('[LOG HANDLER]', error);
		}
	}

	/**
	 * logs an unspecified amount of embeds to console and to the logging channel
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

			returnValue.push(this._log(embedChunk));
		}

		return Promise.all(returnValue);
	}

	/**
	 * logs up to 10 embeds to console and to the logging channel
	 * @param {...MessageEmbed} embedsInput embeds to log
	 */
	async log(...embedsInput) {
		return this._log(this._prepareEmbeds(embedsInput));
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
	 * log to console and send in the logging channel
	 * @param {MessageEmbed[]} embedsInput
	 */
	async _log(embeds) {
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

		const { channel } = this;

		// no logging channel
		if (!channel) return this._logToFile(embeds);

		// API call
		try {
			return await channel.send({
				embeds,
			});
		} catch (error) {
			logger.error('[CLIENT LOG]', error);

			this._logToFile(embeds);

			return null;
		}
	}

	/**
	 * create log_buffer folder if it is non-existent
	 */
	async _createLogBufferFolder() {
		try {
			await mkdir(this.logPath);
			logger.debug('[LOG BUFFER]: created \'log_buffer\' folder');
			return true;
		} catch { // rejects if folder already exists
			return false;
		}
	}

	/**
	 * write data in 'cwd/log_buffer'
	 * @param {MessageEmbed[]} embeds file content
	 */
	async _logToFile(embeds) {
		try {
			await this._createLogBufferFolder();
			await writeFile(
				join(this.logPath, `${new Date()
					.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
					.replace(', ', '_')
					.replace(/:/g, '.')
				}_${SnowflakeUtil.generate()}`),
				embeds.map(embed => JSON.stringify(embed)).join('\n'),
			);
		} catch (error) {
			logger.error('[LOG TO FILE]', error);
		}
	}

	/**
	 * read all files from 'cwd/log_buffer' and log their parsed content in the logging channel
	 */
	async _postFileLogs() {
		try {
			await this._createLogBufferFolder();

			const logBufferFiles = await readdir(this.logPath);

			if (!logBufferFiles) return;

			for (const file of logBufferFiles) {
				const FILE_PATH = join(this.logPath, file);
				const FILE_CONTENT = await readFile(FILE_PATH, 'utf8');

				await this.log(...FILE_CONTENT.split('\n').map(x => new MessageEmbed(JSON.parse(x))));
				await unlink(FILE_PATH);
			}
		} catch (error) {
			logger.error('[POST FILE LOGS]', error);
		}
	}
};
