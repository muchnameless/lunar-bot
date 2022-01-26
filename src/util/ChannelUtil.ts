import { ChannelType, Permissions } from 'discord.js';
import { commaListsAnd } from 'common-tags';
import { PermissionFlagsBits } from 'discord-api-types/v9';
import ms from 'ms';
import { logger } from '../functions';
import { EMBEDS_MAX_AMOUNT, EMBED_MAX_CHARS, MESSAGE_MAX_CHARS } from '../constants';
import type { AnyChannel, Embed, Message, MessageOptions, Snowflake, TextBasedChannel, TextChannel } from 'discord.js';

export interface SendOptions extends MessageOptions {
	rejectOnError?: boolean;
}

export default class ChannelUtil extends null {
	static DM_PERMISSIONS = new Permissions()
		.add([
			PermissionFlagsBits.AddReactions,
			PermissionFlagsBits.ViewChannel,
			PermissionFlagsBits.SendMessages,
			PermissionFlagsBits.SendTTSMessages,
			PermissionFlagsBits.EmbedLinks,
			PermissionFlagsBits.AttachFiles,
			PermissionFlagsBits.ReadMessageHistory,
			PermissionFlagsBits.MentionEveryone,
			PermissionFlagsBits.UseExternalEmojis,
		])
		.freeze();

	static DEFAULT_SEND_PERMISSIONS = PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages;

	/**
	 * @param channel
	 */
	static logInfo(channel: AnyChannel | null) {
		if (!channel) return null;

		switch (channel.type) {
			case ChannelType.DM:
				return `#${channel.recipient?.tag ?? `DM-${channel.recipient.id}`}`;

			default:
				return `#${channel.name}`;
		}
	}

	/**
	 * @param channel
	 */
	static botPermissions(channel: AnyChannel): Readonly<Permissions>;
	static botPermissions(channel: null): null;
	static botPermissions(channel: AnyChannel | null): Readonly<Permissions> | null;
	static botPermissions(channel: AnyChannel | null): Readonly<Permissions> | null {
		if (!channel) return null;

		switch (channel.type) {
			case ChannelType.DM:
				return this.DM_PERMISSIONS;

			default:
				return channel.permissionsFor(channel.client.user!);
		}
	}

	/**
	 * deletes all provided messages from the channel with as few API calls as possible
	 * @param channel
	 * @param IdOrIds
	 */
	static async deleteMessages(channel: TextBasedChannel | null, IdOrIds: Snowflake | Snowflake[]) {
		if (!channel?.isTextBased()) {
			return logger.warn(`[CHANNEL DELETE MESSAGES]: ${this.logInfo(channel)} is not a text based channel`);
		}

		try {
			switch (channel.type) {
				case ChannelType.DM:
					if (Array.isArray(IdOrIds)) return await Promise.all(IdOrIds.map((id) => channel.messages.delete(id)));

					return await channel.messages.delete(IdOrIds);

				default: {
					if (Array.isArray(IdOrIds)) {
						if (this.botPermissions(channel).has(PermissionFlagsBits.ManageMessages)) {
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
			return logger.error(error, '[CHANNEL DELETE MESSAGES]');
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
			const MESSAGE = `[CHANNEL SEND]: content length ${_options.content!.length} > ${MESSAGE_MAX_CHARS}`;
			if (_options.rejectOnError) throw new Error(MESSAGE);
			logger.warn(_options, MESSAGE);
			return null;
		}

		if (Reflect.has(_options, 'reply')) requiredChannelPermissions |= PermissionFlagsBits.ReadMessageHistory;

		if (Reflect.has(_options, 'embeds')) {
			if (_options.embeds!.length > EMBEDS_MAX_AMOUNT) {
				const MESSAGE = `[CHANNEL SEND]: embeds length ${_options.embeds!.length} > ${EMBEDS_MAX_AMOUNT}`;

				if (_options.rejectOnError) throw new Error(MESSAGE);
				logger.warn(_options, MESSAGE);
				return null;
			}

			const TOTAL_LENGTH = _options.embeds!.reduce(
				(acc, cur) => acc + (cur as Embed).length ?? Number.POSITIVE_INFINITY,
				0,
			);

			if (TOTAL_LENGTH > EMBED_MAX_CHARS) {
				const MESSAGE = `[CHANNEL SEND]: embeds total char length ${TOTAL_LENGTH} > ${EMBED_MAX_CHARS}`;

				if (_options.rejectOnError) throw new Error(MESSAGE);
				logger.warn(_options, MESSAGE);
				return null;
			}

			requiredChannelPermissions |= PermissionFlagsBits.EmbedLinks;
		}

		if (Reflect.has(_options, 'files')) requiredChannelPermissions |= PermissionFlagsBits.AttachFiles;

		// permission checks
		if (!this.botPermissions(channel).has(requiredChannelPermissions)) {
			const missingChannelPermissions = this.botPermissions(channel)
				.missing(requiredChannelPermissions)
				.map((permission) => `'${permission}'`);
			const MESSAGE = commaListsAnd`[CHANNEL SEND]: missing ${missingChannelPermissions} permission${
				missingChannelPermissions?.length === 1 ? '' : 's'
			} in ${this.logInfo(channel)}
			`;

			if (_options.rejectOnError) throw new Error(MESSAGE);
			logger.warn(_options, MESSAGE);
			return null;
		}

		if ((channel as TextChannel).guild?.me!.isCommunicationDisabled()) {
			const MESSAGE = `[CHANNEL SEND]: bot timed out in '${(channel as TextChannel).guild.name}' for ${ms(
				(channel as TextChannel).guild.me!.communicationDisabledUntilTimestamp! - Date.now(),
				{ long: true },
			)}`;

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
