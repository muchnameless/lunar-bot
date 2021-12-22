import { Permissions } from 'discord.js';
import { commaListsAnd } from 'common-tags';
import { logger } from '../functions';
import { EMBEDS_MAX_AMOUNT, EMBED_MAX_CHARS, MESSAGE_MAX_CHARS } from '../constants';
import type {
	Channel,
	DMChannel,
	GuildChannel,
	Message,
	MessageEmbed,
	MessageOptions,
	PartialDMChannel,
	Snowflake,
	TextBasedChannel,
} from 'discord.js';

export interface SendOptions extends MessageOptions {
	rejectOnError?: boolean;
}

export default class ChannelUtil extends null {
	static DM_PERMISSIONS = new Permissions()
		.add([
			Permissions.FLAGS.ADD_REACTIONS,
			Permissions.FLAGS.VIEW_CHANNEL,
			Permissions.FLAGS.SEND_MESSAGES,
			Permissions.FLAGS.SEND_TTS_MESSAGES,
			Permissions.FLAGS.EMBED_LINKS,
			Permissions.FLAGS.ATTACH_FILES,
			Permissions.FLAGS.READ_MESSAGE_HISTORY,
			Permissions.FLAGS.MENTION_EVERYONE,
			Permissions.FLAGS.USE_EXTERNAL_EMOJIS,
		])
		.freeze();

	static DEFAULT_SEND_PERMISSIONS = Permissions.FLAGS.VIEW_CHANNEL | Permissions.FLAGS.SEND_MESSAGES;

	/**
	 * @param channel
	 */
	static logInfo(channel: Channel | PartialDMChannel | null) {
		if (!channel) return null;

		switch (channel.type) {
			case 'DM':
				return `#${(channel as DMChannel).recipient?.tag ?? `DM-${(channel as DMChannel).recipient.id}`}`;

			default:
				return `#${(channel as GuildChannel).name}`;
		}
	}

	/**
	 * @param channel
	 */
	static botPermissions(channel: Channel | PartialDMChannel): Readonly<Permissions>;
	static botPermissions(channel: null): null;
	static botPermissions(channel: Channel | PartialDMChannel | null): Readonly<Permissions> | null;
	static botPermissions(channel: Channel | PartialDMChannel | null): Readonly<Permissions> | null {
		if (!channel) return null;

		switch (channel.type) {
			case 'DM':
				return this.DM_PERMISSIONS;

			default:
				return (channel as GuildChannel).permissionsFor(channel.client.user!);
		}
	}

	/**
	 * deletes all provided messages from the channel with as few API calls as possible
	 * @param channel
	 * @param IdOrIds
	 */
	static async deleteMessages(channel: TextBasedChannel | null, IdOrIds: Snowflake | Snowflake[]) {
		if (!channel?.isText()) {
			return logger.warn(`[DELETE MESSAGES]: ${this.logInfo(channel)} is not a text based channel`);
		}

		try {
			switch (channel.type) {
				case 'DM':
					if (Array.isArray(IdOrIds)) return await Promise.all(IdOrIds.map((id) => channel.messages.delete(id)));

					return await channel.messages.delete(IdOrIds);

				default: {
					if (Array.isArray(IdOrIds)) {
						if (this.botPermissions(channel).has(Permissions.FLAGS.MANAGE_MESSAGES)) {
							return await channel.bulkDelete(IdOrIds);
						}

						return await Promise.all(
							IdOrIds.map((id) => {
								const message = channel.messages.cache.get(id);

								if (!message?.deletable) return null;

								return channel.messages.delete(id);
							}),
						);
					}

					const message = channel.messages.cache.get(IdOrIds);

					if (!message?.deletable) return;

					return await channel.messages.delete(IdOrIds);
				}
			}
		} catch (error) {
			return logger.error(error);
		}
	}

	/**
	 * @param channel
	 * @param options
	 */
	static async send(channel: TextBasedChannel, options: SendOptions & { rejectOnError: true }): Promise<Message>;
	static async send(channel: TextBasedChannel, options: string | SendOptions): Promise<Message | null>;
	static async send(channel: TextBasedChannel, options: string | SendOptions) {
		const _options = typeof options === 'string' ? { content: options } : options;

		// guild -> requires permission
		let requiredChannelPermissions = this.DEFAULT_SEND_PERMISSIONS;

		if ((_options.content?.length ?? 0) > MESSAGE_MAX_CHARS) {
			const MESSAGE = `[CHANNEL UTIL]: content length ${_options.content!.length} > ${MESSAGE_MAX_CHARS}`;
			if (_options.rejectOnError) throw new Error(MESSAGE);
			logger.warn(_options, MESSAGE);
			return null;
		}

		if (Reflect.has(_options, 'reply')) requiredChannelPermissions |= Permissions.FLAGS.READ_MESSAGE_HISTORY;

		if (Reflect.has(_options, 'embeds')) {
			if (_options.embeds!.length > EMBEDS_MAX_AMOUNT) {
				const MESSAGE = `[CHANNEL UTIL]: embeds length ${_options.embeds!.length} > ${EMBEDS_MAX_AMOUNT}`;

				if (_options.rejectOnError) throw new Error(MESSAGE);
				logger.warn(_options, MESSAGE);
				return null;
			}

			const TOTAL_LENGTH = _options.embeds!.reduce(
				(acc, cur) => acc + (cur as MessageEmbed).length ?? Number.POSITIVE_INFINITY,
				0,
			);

			if (TOTAL_LENGTH > EMBED_MAX_CHARS) {
				const MESSAGE = `[CHANNEL UTIL]: embeds total char length ${TOTAL_LENGTH} > ${EMBED_MAX_CHARS}`;

				if (_options.rejectOnError) throw new Error(MESSAGE);
				logger.warn(_options, MESSAGE);
				return null;
			}

			requiredChannelPermissions |= Permissions.FLAGS.EMBED_LINKS;
		}

		if (Reflect.has(_options, 'files')) requiredChannelPermissions |= Permissions.FLAGS.ATTACH_FILES;

		// permission checks
		if (!this.botPermissions(channel).has(requiredChannelPermissions)) {
			const missingChannelPermissions = this.botPermissions(channel)
				.missing(requiredChannelPermissions)
				.map((permission) => `'${permission}'`);
			const MESSAGE = commaListsAnd`[CHANNEL UTIL]: missing ${missingChannelPermissions} permission${
				missingChannelPermissions?.length === 1 ? '' : 's'
			} in ${this.logInfo(channel)}
			`;

			if (_options.rejectOnError) throw new Error(MESSAGE);
			logger.warn(_options, MESSAGE);
			return null;
		}

		try {
			return await channel.send(_options);
		} catch (error) {
			if (_options.rejectOnError) throw error;
			logger.error(error);
			return null;
		}
	}
}
