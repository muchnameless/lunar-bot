import { type Dir } from 'node:fs';
import { mkdir, opendir, readFile, rm, writeFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { EmbedLimits, MessageLimits } from '@sapphire/discord-utilities';
import {
	PermissionFlagsBits,
	SnowflakeUtil,
	embedLength,
	isJSONEncodable,
	type APIEmbed,
	type GuildChannel,
	type JSONEncodable,
	type Message,
	type TextChannel,
} from 'discord.js';
import ms from 'ms';
import { commaListAnd } from '#functions';
import { logger } from '#logger';
import { type LunarClient } from '#structures/LunarClient.js';
import { ChannelUtil } from '#utils';

type LogInput = APIEmbed | JSONEncodable<APIEmbed> | number | string | null | undefined;

export class LogHandler {
	public declare readonly client: LunarClient;

	private readonly logURL: URL;

	private readonly REQUIRED_CHANNEL_PERMISSIONS =
		PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages | PermissionFlagsBits.EmbedLinks;

	/**
	 * @param client
	 * @param logURL
	 */
	public constructor(client: LunarClient, logURL: URL) {
		Object.defineProperty(this, 'client', { value: client });

		this.logURL = logURL;
	}

	/**
	 * logging channel
	 */
	public get channel() {
		const channel = this.client.channels.cache.get(this.client.config.get('LOGGING_CHANNEL_ID'));

		if (!channel?.isTextBased()) {
			logger.error(
				`[LOG HANDLER]: ${
					channel ? `#${(channel as GuildChannel).name ?? channel.id}` : this.client.config.get('LOGGING_CHANNEL_ID')
				} is not a cached text based channel (id)`,
			);
			return null;
		}

		if (!ChannelUtil.botPermissions(channel).has(this.REQUIRED_CHANNEL_PERMISSIONS, false)) {
			logger.error(
				`[LOG HANDLER]: missing ${commaListAnd(
					ChannelUtil.botPermissions(channel)
						.missing(this.REQUIRED_CHANNEL_PERMISSIONS, false)
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
	 * whether the log handler has a valid channel with all necessary permissions
	 */
	public get ready() {
		return this.channel !== null;
	}

	/**
	 * posts all remaining file logs from the log_buffer
	 */
	public async init() {
		if (!this.channel) return this;

		try {
			await this._postFileLogs(); // repost logs that failed to be posted during the last uptime
		} catch (error) {
			logger.error(error, '[LOG HANDLER]: init');
		}

		return this;
	}

	/**
	 * logs embeds to console and to the logging channel
	 *
	 * @param input - embeds to log
	 */
	public log(input: LogInput): Promise<Message | null>;
	public log(...input: LogInput[]): Promise<(Message | null)[] | Message | null>;
	public async log(...input: LogInput[]): Promise<(Message | null)[] | Message | null> {
		const embeds = this._transformInput(input);

		if (!embeds.length) return null; // nothing to log

		// send 1 message
		if (
			embeds.length <= MessageLimits.MaximumEmbeds &&
			embeds.reduce((acc, cur) => acc + embedLength(cur), 0) <= EmbedLimits.MaximumTotalCharacters
		) {
			return this._log(embeds);
		}

		// split into multiple messages
		const returnValue: Promise<Message | null>[] = [];

		for (let total = 0; total < embeds.length; ++total) {
			const embedChunk: APIEmbed[] = [];

			let embedChunkLength = 0;

			for (let current = 0; current < MessageLimits.MaximumEmbeds && total < embeds.length; ++current, ++total) {
				embedChunkLength += embedLength(embeds[total]!);

				// adding the new embed would exceed the max char count
				if (embedChunkLength > EmbedLimits.MaximumTotalCharacters) {
					--total;
					break;
				}

				embedChunk.push(embeds[total]!);
			}

			returnValue.push(this._log(embedChunk));
		}

		return Promise.all(returnValue);
	}

	/**
	 * make sure all elements are instances of MessageEmbed
	 *
	 * @param input
	 */
	private _transformInput(input: LogInput[]) {
		const embeds: APIEmbed[] = [];

		for (const maybeEmbed of input) {
			if (maybeEmbed === null || maybeEmbed === undefined) continue; // filter out null & undefined

			if (isJSONEncodable(maybeEmbed)) {
				embeds.push(maybeEmbed.toJSON());
			} else if (typeof maybeEmbed === 'object') {
				embeds.push(this.client.options.jsonTransformer!(maybeEmbed) as APIEmbed);
			} else if (['string', 'number'].includes(typeof maybeEmbed)) {
				embeds.push(this.client.defaultEmbed.setDescription(`${maybeEmbed}`).toJSON());
			} else {
				throw new TypeError(
					`[TRANSFORM INPUT]: provided argument '${maybeEmbed}' is a '${typeof maybeEmbed}' instead of an Object or String`,
				);
			}
		}

		return embeds;
	}

	/**
	 * log to console and send in the logging channel
	 *
	 * @param embeds
	 */
	private async _log(embeds: APIEmbed[]) {
		// log to console
		for (const embed of embeds) {
			logger.info(embed, embed.title);
		}

		const { channel } = this;

		// no logging channel
		if (!channel) return this._logToFile(embeds);

		// API call
		try {
			// eslint-disable-next-line @typescript-eslint/return-await
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
	 *
	 * @param embeds - file content
	 */
	private async _logToFile(embeds: (APIEmbed | JSONEncodable<APIEmbed>)[]) {
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

		return null;
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
