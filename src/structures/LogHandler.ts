import { MessageAttachment, MessageEmbed, Permissions, SnowflakeUtil } from 'discord.js';
import { commaListsAnd } from 'common-tags';
import { mkdir, writeFile, readdir, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EMBED_MAX_CHARS, EMBEDS_MAX_AMOUNT } from '../constants';
import { ChannelUtil } from '../util';
import { logger } from '../functions';
import type { GuildChannel, Snowflake } from 'discord.js';
import type { URL } from 'node:url';
import type { LunarClient } from './LunarClient';


export class LogHandler {
	client: LunarClient;
	logURL: URL;

	/**
	 * @param client
	 * @param logURL
	 */
	constructor(client: LunarClient, logURL: URL) {
		this.client = client;
		this.logURL = logURL;
	}

	static REQUIRED_CHANNEL_PERMISSIONS = Permissions.FLAGS.VIEW_CHANNEL | Permissions.FLAGS.SEND_MESSAGES | Permissions.FLAGS.EMBED_LINKS;

	/**
	 * cleans a string from an embed for console logging
	 * @param string the string to clean
	 */
	static cleanLoggingEmbedString(string: string | null) {
		if (typeof string === 'string') return string
			.replace(/```(?:js|diff|cs|ada|undefined)?\n/g, '') // code blocks
			.replace(/`|\*|\n?\u200B|\\(?=_)/g, '') // inline code blocks, discord formatting, escaped '_'
			.replace(/\n{2,}/g, '\n'); // consecutive line-breaks

		return null;
	}

	/**
	 * logging channel
	 */
	get channel() {
		const channel = this.client.channels.cache.get(this.client.config.get('LOGGING_CHANNEL_ID') as Snowflake);

		if (!channel?.isText()) return logger.error(`[LOG HANDLER]: ${channel ? `#${(channel as GuildChannel).name}` : this.client.config.get('LOGGING_CHANNEL_ID')} is not a cached text based channel (id)`);

		if (!ChannelUtil.botPermissions(channel)?.has(LogHandler.REQUIRED_CHANNEL_PERMISSIONS)) {
			return logger.error(commaListsAnd`[LOG HANDLER]: missing ${ChannelUtil.botPermissions(channel)
				?.missing(LogHandler.REQUIRED_CHANNEL_PERMISSIONS)
				.map(permission => `'${permission}'`)}`);
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
			return await this.#postFileLogs(); // repost logs that failed to be posted during the last uptime
		} catch (error) {
			logger.error('[LOG HANDLER]', error);
		}
	}

	/**
	 * logs embeds to console and to the logging channel
	 * @param input embeds to log
	 */
	async log(...input: (MessageEmbed | MessageAttachment | string)[]) {
		const { embeds, files } = this.#transformInput(input);

		if (!embeds.length) return null; // nothing to log

		// send 1 message
		if (embeds.length <= EMBEDS_MAX_AMOUNT && embeds.reduce((acc, cur) => acc + cur.length, 0) <= EMBED_MAX_CHARS) return this.#log({ embeds, files });

		// split into multiple messages
		const returnValue = [];

		for (let total = 0; total < embeds.length; ++total) {
			const embedChunk = [];

			let embedChunkLength = 0;

			for (let current = 0; current < EMBEDS_MAX_AMOUNT && total < embeds.length; ++current, ++total) inner: {
				embedChunkLength += embeds[total].length;

				// adding the new embed would exceed the max char count
				if (embedChunkLength > EMBED_MAX_CHARS) {
					--total;
					break inner;
				}

				embedChunk.push(embeds[total]);
			}

			returnValue.push(this.#log({ embeds: embedChunk, files }));
		}

		return Promise.all(returnValue);
	}

	/**
	 * make sure all elements are instances of MessageEmbed
	 * @param input
	 */
	#transformInput(input: (MessageEmbed | MessageAttachment | string)[]) {
		const embeds = [];
		const files = [];

		for (const i of input) {
			if (i == null) continue; // filter out null & undefined

			if (i instanceof MessageEmbed) {
				embeds.push(i);
			} else if (i instanceof MessageAttachment) {
				files.push(i);
			} else if (typeof i === 'string' || typeof i === 'number') {
				embeds.push(this.client.defaultEmbed.setDescription(`${i}`));
			} else if (typeof i !== 'object') {
				throw new TypeError(`[TRANSFORM INPUT]: provided argument '${i}' is a ${typeof i} instead of an Object or String`);
			} else {
				embeds.push(new MessageEmbed(i));
			}
		}

		return { embeds, files };
	}

	/**
	 * log to console and send in the logging channel
	 * @param input
	 */
	async #log({ embeds, files }: { embeds: MessageEmbed[], files?: MessageAttachment[] }) {
		// log to console
		for (const embed of embeds) {
			const FIELDS_LOG = embed.fields?.filter(({ name, value }) => name !== '\u200B' || value !== '\u200B');

			logger.info([
				[
					embed.title,
					LogHandler.cleanLoggingEmbedString(embed.description),
					embed.author?.name,
				].filter(x => x != null).join(': '),
				FIELDS_LOG?.length
					? FIELDS_LOG
						.map(({ name, value }) => `${name !== '\u200B' ? `${name.replaceAll('\u200B', '').trim()}: ` : ''}${LogHandler.cleanLoggingEmbedString(value)?.replace(/\n/g, ', ')}`)
						.join('\n')
					: null,
			]
				.filter(x => x != null)
				.join('\n'),
			);
		}

		const { channel } = this;

		// no logging channel
		if (!channel) return this.#logToFile(embeds);

		// API call
		try {
			return await channel.send({ embeds, files });
		} catch (error) {
			logger.error('[CLIENT LOG]', error);

			this.#logToFile(embeds);

			return null;
		}
	}

	/**
	 * create log_buffer folder if it is non-existent
	 */
	async #createLogBufferFolder() {
		try {
			await mkdir(this.logURL);
			logger.info('[LOG BUFFER]: created \'log_buffer\' folder');
			return true;
		} catch { // rejects if folder already exists
			return false;
		}
	}

	/**
	 * write data in 'cwd/log_buffer'
	 * @param embeds file content
	 */
	async #logToFile(embeds: MessageEmbed[]) {
		try {
			await this.#createLogBufferFolder();
			await writeFile(
				join(fileURLToPath(this.logURL), `${new Date()
					.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
					.replace(', ', '_')
					.replaceAll(':', '.')
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
	async #postFileLogs() {
		try {
			await this.#createLogBufferFolder();

			const logBufferFiles = await readdir(this.logURL);

			if (!logBufferFiles) return;

			for (const file of logBufferFiles) {
				const FILE_PATH = join(fileURLToPath(this.logURL), file);
				const FILE_CONTENT = await readFile(FILE_PATH, 'utf8');

				await this.#log({ embeds: FILE_CONTENT.split('\n').map(x => new MessageEmbed(JSON.parse(x))) });
				await unlink(FILE_PATH);
			}
		} catch (error) {
			logger.error('[POST FILE LOGS]', error);
		}
	}
}
