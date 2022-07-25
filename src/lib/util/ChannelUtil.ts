import { ChannelType, PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import { EmbedLimits, MessageLimits } from '@sapphire/discord-utilities';
import ms from 'ms';
import { logger } from '#logger';
import { commaListAnd } from '#functions';
import { EmbedUtil } from './EmbedUtil';
import type { Channel, Message, MessageOptions, Snowflake, TextBasedChannel, TextChannel } from 'discord.js';

export interface SendOptions extends MessageOptions {
	rejectOnError?: boolean;
}

export class ChannelUtil extends null {
	static DM_PERMISSIONS = new PermissionsBitField()
		.add(
			PermissionFlagsBits.AddReactions,
			PermissionFlagsBits.ViewChannel,
			PermissionFlagsBits.SendMessages,
			PermissionFlagsBits.SendTTSMessages,
			PermissionFlagsBits.EmbedLinks,
			PermissionFlagsBits.AttachFiles,
			PermissionFlagsBits.ReadMessageHistory,
			PermissionFlagsBits.MentionEveryone,
			PermissionFlagsBits.UseExternalEmojis,
		)
		.freeze();

	static DEFAULT_SEND_PERMISSIONS = PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages;

	/**
	 * @param channel
	 */
	static logInfo(channel: Channel | null) {
		if (!channel) return null;

		switch (channel.type) {
			case ChannelType.DM:
				return `#${channel.recipient?.tag ?? `DM-${channel.recipientId}`}`;

			default:
				return `#${channel.name}`;
		}
	}

	/**
	 * @param channel
	 */
	static botPermissions(channel: Channel): Readonly<PermissionsBitField>;
	static botPermissions(channel: null): null;
	static botPermissions(channel: Channel | null): Readonly<PermissionsBitField> | null;
	static botPermissions(channel: Channel | null) {
		if (!channel) return null;

		switch (channel.type) {
			case ChannelType.DM:
			case ChannelType.GroupDM:
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
			return logger.warn({ channel, data: IdOrIds }, '[CHANNEL DELETE MESSAGES]: not a text based channel');
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
			return logger.error({ channel, err: error, data: IdOrIds }, '[CHANNEL DELETE MESSAGES]');
		}
	}

	/**
	 * @param channel
	 * @param options
	 * @param permissions
	 */
	static async send(
		channel: TextBasedChannel,
		options: SendOptions & { rejectOnError: true },
		permissions?: Readonly<PermissionsBitField>,
	): Promise<Message>;
	static async send(
		channel: TextBasedChannel,
		options: string | SendOptions,
		permissions?: Readonly<PermissionsBitField>,
	): Promise<Message | null>;
	static async send(
		channel: TextBasedChannel,
		options: string | SendOptions,
		permissions = this.botPermissions(channel),
	) {
		const _options = typeof options === 'string' ? { content: options } : options;

		// guild -> requires permission
		let requiredChannelPermissions = this.DEFAULT_SEND_PERMISSIONS;

		if ((_options.content?.length ?? 0) > MessageLimits.MaximumLength) {
			const MESSAGE = `content length ${_options.content!.length} > ${MessageLimits.MaximumLength}`;

			if (_options.rejectOnError) throw new Error(MESSAGE);
			logger.warn({ channel, data: _options }, `[CHANNEL SEND]: ${MESSAGE}`);
			return null;
		}

		if (Reflect.has(_options, 'reply')) {
			if ((_options.reply!.messageReference as Message).system) {
				const MESSAGE = 'cannot reply to a system message';

				if (_options.rejectOnError) throw new Error(MESSAGE);
				logger.warn({ channel, data: _options }, `[CHANNEL SEND]: ${MESSAGE}`);
				return null;
			}

			requiredChannelPermissions |= PermissionFlagsBits.ReadMessageHistory;
		}

		if (Reflect.has(_options, 'embeds')) {
			if (_options.embeds!.length > MessageLimits.MaximumEmbeds) {
				const MESSAGE = `embeds length ${_options.embeds!.length} > ${MessageLimits.MaximumEmbeds}`;

				if (_options.rejectOnError) throw new Error(MESSAGE);
				logger.warn({ channel, data: _options }, `[CHANNEL SEND]: ${MESSAGE}`);
				return null;
			}

			const TOTAL_LENGTH = EmbedUtil.totalLength(_options.embeds!);

			if (TOTAL_LENGTH > EmbedLimits.MaximumTotalCharacters) {
				const MESSAGE = `embeds total char length ${TOTAL_LENGTH} > ${EmbedLimits.MaximumTotalCharacters}`;

				if (_options.rejectOnError) throw new Error(MESSAGE);
				logger.warn({ channel, data: _options }, `[CHANNEL SEND]: ${MESSAGE}`);
				return null;
			}

			requiredChannelPermissions |= PermissionFlagsBits.EmbedLinks;
		}

		if (Reflect.has(_options, 'files')) requiredChannelPermissions |= PermissionFlagsBits.AttachFiles;

		// permission checks
		if (!permissions.has(requiredChannelPermissions)) {
			const missingChannelPermissions = permissions
				.missing(requiredChannelPermissions)
				.map((permission) => `'${permission}'`);
			const MESSAGE = `missing ${commaListAnd(missingChannelPermissions)} permission${
				missingChannelPermissions?.length === 1 ? '' : 's'
			} in ${this.logInfo(channel)}`;

			if (_options.rejectOnError) throw new Error(MESSAGE);
			logger.warn({ channel, data: _options }, `[CHANNEL SEND]: ${MESSAGE}`);
			return null;
		}

		if ((channel as TextChannel).guild?.members.me!.isCommunicationDisabled()) {
			const MESSAGE = `bot timed out in '${(channel as TextChannel).guild.name}' for ${ms(
				(channel as TextChannel).guild.members.me!.communicationDisabledUntilTimestamp! - Date.now(),
				{ long: true },
			)}`;

			if (_options.rejectOnError) throw new Error(MESSAGE);
			logger.warn({ channel, data: _options }, `[CHANNEL SEND]: ${MESSAGE}`);
			return null;
		}

		try {
			return await channel.send(_options);
		} catch (error) {
			if (_options.rejectOnError) throw error;
			logger.error({ channel, err: error, data: _options }, '[CHANNEL SEND]');
			return null;
		}
	}
}
