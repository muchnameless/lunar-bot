import { mkdir, opendir, readFile, rm, writeFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { PermissionFlagsBits, SnowflakeUtil, embedLength, isJSONEncodable } from 'discord.js';
import ms from 'ms';
import { EMBED_MAX_CHARS, EMBEDS_MAX_AMOUNT } from '../constants';
import { ChannelUtil } from '../util';
import { commaListAnd } from '../functions';
import { logger } from '../logger';
import type { Dir } from 'node:fs';
import type { GuildChannel, JSONEncodable, Message, TextChannel } from 'discord.js';
import type { APIEmbed } from 'discord-api-types/v10';
import type { LunarClient } from './LunarClient';

type LogInput = JSONEncodable<APIEmbed> | APIEmbed | string | number | null | undefined;

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

	static REQUIRED_CHANNEL_PERMISSIONS =
		PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages | PermissionFlagsBits.EmbedLinks;

	/**
	 * cleans a string from an embed for console logging
	 * @param string the string to clean
	 */
	static cleanLoggingEmbedString(string: string): string;
	static cleanLoggingEmbedString(string: string | undefined): string | null;
	static cleanLoggingEmbedString(string: unknown) {
		if (typeof string === 'string') {
			return string
				.replace(/```(?:ada|cs|diff|js|undefined)?\n/g, '') // code blocks
				.replace(/`|\*|\n?\u200B|\\(?=_)/g, '') // inline code blocks, discord formatting, escaped '_'
				.replace(/\n{2,}/g, '\n'); // consecutive line-breaks
		}

		return null;
	}

	/**
	 * logging channel
	 */
	get channel() {
		const channel = this.client.channels.cache.get(this.client.config.get('LOGGING_CHANNEL_ID'));

		if (!channel?.isTextBased()) {
			logger.error(
				`[LOG HANDLER]: ${
					channel ? `#${(channel as GuildChannel).name ?? channel.id}` : this.client.config.get('LOGGING_CHANNEL_ID')
				} is not a cached text based channel (id)`,
			);
			return null;
		}

		if (!ChannelUtil.botPermissions(channel).has(LogHandler.REQUIRED_CHANNEL_PERMISSIONS)) {
			logger.error(
				`[LOG HANDLER]: missing ${commaListAnd(
					ChannelUtil.botPermissions(channel)
						.missing(LogHandler.REQUIRED_CHANNEL_PERMISSIONS)
						.map((permission) => `'${permission}'`),
				)}
				`,
			);
			return null;
		}

		if ((channel as TextChannel).guild?.members.me!.isCommunicationDisabled()) {
			const {
				members: { me },
				name,
			} = (channel as TextChannel).guild;
			logger.error(
				`[LOG HANDLER]: bot timed out in '${name}' for ${ms(me!.communicationDisabledUntilTimestamp! - Date.now(), {
					long: true,
				})}`,
			);
			return null;
		}

		return channel;
	}

	/**
	 * whether the log handler has a valid channel with all neccessary permissions
	 */
	get ready() {
		return Boolean(this.channel);
	}

	/**
	 * posts all remaining file logs from the log_buffer
	 */
	async init() {
		if (!this.channel) return this;

		try {
			await this._postFileLogs(); // repost logs that failed to be posted during the last uptime
		} catch (error) {
			logger.error(error, '[LOG HANDLER]');
		}

		return this;
	}

	/**
	 * logs embeds to console and to the logging channel
	 * @param input embeds to log
	 */
	log(input: LogInput): Promise<void | Message>;
	log(...input: LogInput[]): Promise<void | Message> | Promise<(void | Message)[]>;
	log(...input: LogInput[]) {
		const embeds = this._transformInput(input);

		if (!embeds.length) return null; // nothing to log

		// send 1 message
		if (
			embeds.length <= EMBEDS_MAX_AMOUNT &&
			embeds.reduce((acc, cur) => acc + embedLength(cur), 0) <= EMBED_MAX_CHARS
		) {
			return this._log(embeds);
		}

		// split into multiple messages
		const returnValue: Promise<Message | void>[] = [];

		for (let total = 0; total < embeds.length; ++total) {
			const embedChunk: APIEmbed[] = [];

			let embedChunkLength = 0;

			for (let current = 0; current < EMBEDS_MAX_AMOUNT && total < embeds.length; ++current, ++total) {
				embedChunkLength += embedLength(embeds[total]);

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
	 * make sure all elements are instances of MessageEmbed
	 * @param input
	 */
	private _transformInput(input: LogInput[]) {
		const embeds: APIEmbed[] = [];

		for (const i of input) {
			if (i == null) continue; // filter out null & undefined

			if (isJSONEncodable(i)) {
				embeds.push(i.toJSON());
			} else if (typeof i === 'object') {
				embeds.push(this.client.options.jsonTransformer!(i) as APIEmbed);
			} else if (['string', 'number'].includes(typeof i)) {
				embeds.push(this.client.defaultEmbed.setDescription(`${i}`).toJSON());
			} else {
				throw new TypeError(
					`[TRANSFORM INPUT]: provided argument '${i}' is a '${typeof i}' instead of an Object or String`,
				);
			}
		}

		return embeds;
	}

	/**
	 * log to console and send in the logging channel
	 * @param embeds
	 */
	private async _log(embeds: APIEmbed[]) {
		// log to console
		for (const embed of embeds) {
			logger.info(
				{
					description: LogHandler.cleanLoggingEmbedString(embed.description) || undefined,
					user: embed.author?.name,
					fields: embed.fields
						?.filter(({ name, value }) => name !== '\u200B' || value !== '\u200B')
						.map(({ name, value }) => ({
							name: name.replaceAll('\u200B', '').trim() || undefined,
							value: LogHandler.cleanLoggingEmbedString(value).replaceAll('\n', ', '),
						})),
				},
				embed.title,
			);
		}

		const { channel } = this;

		// no logging channel
		if (!channel) return this._logToFile(embeds);

		// API call
		try {
			return await channel.send({ embeds });
		} catch (error) {
			logger.error(error, '[CLIENT LOG]');

			return this._logToFile(embeds);
		}
	}

	/**
	 * create log_buffer folder if it is non-existent
	 */
	private async _createLogBufferFolder() {
		try {
			await mkdir(this.logURL);
			logger.info("[LOG BUFFER]: created 'log_buffer' folder");
			return true;
		} catch {
			// rejects if folder already exists
			return false;
		}
	}

	/**
	 * write data in 'cwd/log_buffer'
	 * @param embeds file content
	 */
	private async _logToFile(embeds: (JSONEncodable<APIEmbed> | APIEmbed)[]) {
		try {
			await this._createLogBufferFolder();
			await writeFile(
				new URL(
					`${new Date()
						.toLocaleString('de-DE', {
							day: '2-digit',
							month: '2-digit',
							year: 'numeric',
							hour: '2-digit',
							minute: '2-digit',
							second: '2-digit',
						})
						.replace(', ', '_')
						.replaceAll(':', '.')}_${SnowflakeUtil.generate()}`,
					this.logURL,
				),
				JSON.stringify(embeds),
			);
		} catch (error) {
			logger.error(error, '[LOG TO FILE]');
		}
	}

	/**
	 * read all files from 'cwd/log_buffer' and log their parsed content in the logging channel
	 */
	private async _postFileLogs() {
		let dir: Dir;
		try {
			dir = await opendir(this.logURL);
		} catch {
			// directory doesn't exist
			return;
		}

		try {
			for await (const { name } of dir) {
				const FILE_PATH = new URL(name, this.logURL);
				const FILE_CONTENT = await readFile(FILE_PATH, 'utf8');

				await this._log(JSON.parse(FILE_CONTENT));
				await rm(FILE_PATH);
			}

			await rm(this.logURL, { recursive: true });
		} catch (error) {
			logger.error(error, '[POST FILE LOGS]');
		}
	}
}
