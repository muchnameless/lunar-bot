import { EmbedLimits, MessageLimits } from '@sapphire/discord-utilities';
import {
	ChannelType,
	PermissionFlagsBits,
	PermissionsBitField,
	type Channel,
	type Message,
	type MessageOptions,
	type Snowflake,
	type TextBasedChannel,
	type TextChannel,
} from 'discord.js';
import ms from 'ms';
import { GuildUtil, UserUtil, EmbedUtil } from './index.js';
import { commaListAnd } from '#functions';
import { logger } from '#logger';

export interface SendOptions extends MessageOptions {
	rejectOnError?: boolean;
}

export class ChannelUtil extends null {
	private static readonly DM_PERMISSIONS = new PermissionsBitField()
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

	private static readonly DEFAULT_SEND_PERMISSIONS = PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages;

	/**
	 * @param channel
	 */
	public static logInfo(channel: Channel | null | undefined) {
		if (!channel) return null;

		switch (channel.type) {
			case ChannelType.DM: {
				const { recipient } = channel;
				return {
					channelId: channel.id,
					recipient: recipient ? UserUtil.logInfo(recipient) : { userId: channel.recipientId },
				};
			}

			case ChannelType.GroupDM:
				return { channelId: channel.id, channelName: channel.name };

			default:
				return { channelId: channel.id, channelName: channel.name, guild: GuildUtil.logInfo(channel.guild) };
		}
	}

	/**
	 * @param channel
	 */
	public static channelName(channel: Channel | null | undefined) {
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
	public static botPermissions(channel: Channel): Readonly<PermissionsBitField>;
	public static botPermissions(channel: null): null;
	public static botPermissions(channel: Channel | null): Readonly<PermissionsBitField> | null;
	public static botPermissions(channel: Channel | null) {
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
	 *
	 * @param channel
	 * @param IdOrIds
	 */
	public static async deleteMessages(channel: TextBasedChannel | null, IdOrIds: Snowflake | Snowflake[]) {
		if (!channel?.isTextBased()) {
			logger.warn({ channel, data: IdOrIds }, '[CHANNEL DELETE MESSAGES]: not a text based channel');
			return null;
		}

		try {
			switch (channel.type) {
				case ChannelType.DM:
					if (Array.isArray(IdOrIds)) return await Promise.all(IdOrIds.map(async (id) => channel.messages.delete(id)));

					await channel.messages.delete(IdOrIds);
					return null;

				default: {
					if (Array.isArray(IdOrIds)) {
						if (this.botPermissions(channel).has(PermissionFlagsBits.ManageMessages, false)) {
							return await channel.bulkDelete(IdOrIds);
						}

						return await Promise.all(
							IdOrIds.map(async (id) => {
								const message = channel.messages.cache.get(id);

								if (!message?.deletable) return null;

								await channel.messages.delete(id);
								return null;
							}),
						);
					}

					const message = channel.messages.cache.get(IdOrIds);

					if (!message?.deletable) return null;

					await channel.messages.delete(IdOrIds);
					return null;
				}
			}
		} catch (error) {
			logger.error({ channel, err: error, data: IdOrIds }, '[CHANNEL DELETE MESSAGES]');
			return null;
		}
	}

	/**
	 * @param channel
	 * @param options
	 * @param permissions
	 */
	public static async send(
		channel: TextBasedChannel,
		options: SendOptions & { rejectOnError: true },
		permissions?: Readonly<PermissionsBitField>,
	): Promise<Message>;
	public static async send(
		channel: TextBasedChannel,
		options: SendOptions | string,
		permissions?: Readonly<PermissionsBitField>,
	): Promise<Message | null>;
	public static async send(
		channel: TextBasedChannel,
		options: SendOptions | string,
		permissions = this.botPermissions(channel),
	): Promise<Message | null> {
		const _options = typeof options === 'string' ? { content: options } : options;

		// guild -> requires permission
		let requiredChannelPermissions = this.DEFAULT_SEND_PERMISSIONS;

		if ((_options.content?.length ?? 0) > MessageLimits.MaximumLength) {
			const MESSAGE = `content length ${_options.content!.length} > ${MessageLimits.MaximumLength}`;

			if (_options.rejectOnError) throw new Error(MESSAGE);
			logger.warn({ channel, data: _options }, `[CHANNEL SEND]: ${MESSAGE}`);
			return null;
		}

		if (_options.reply) {
			if (channel.messages.resolve(_options.reply.messageReference)?.system) {
				const MESSAGE = 'cannot reply to a system message';

				if (_options.rejectOnError) throw new Error(MESSAGE);
				logger.warn({ channel, data: _options }, `[CHANNEL SEND]: ${MESSAGE}`);
				return null;
			}

			requiredChannelPermissions |= PermissionFlagsBits.ReadMessageHistory;
		}

		if (_options.embeds) {
			if (_options.embeds.length > MessageLimits.MaximumEmbeds) {
				const MESSAGE = `embeds length ${_options.embeds.length} > ${MessageLimits.MaximumEmbeds}`;

				if (_options.rejectOnError) throw new Error(MESSAGE);
				logger.warn({ channel, data: _options }, `[CHANNEL SEND]: ${MESSAGE}`);
				return null;
			}

			const TOTAL_LENGTH = EmbedUtil.totalLength(_options.embeds);

			if (TOTAL_LENGTH > EmbedLimits.MaximumTotalCharacters) {
				const MESSAGE = `embeds total char length ${TOTAL_LENGTH} > ${EmbedLimits.MaximumTotalCharacters}`;

				if (_options.rejectOnError) throw new Error(MESSAGE);
				logger.warn({ channel, data: _options }, `[CHANNEL SEND]: ${MESSAGE}`);
				return null;
			}

			requiredChannelPermissions |= PermissionFlagsBits.EmbedLinks;
		}

		if (_options.files) requiredChannelPermissions |= PermissionFlagsBits.AttachFiles;

		// permission checks
		if (!permissions.has(requiredChannelPermissions, false)) {
			const missingChannelPermissions = permissions
				.missing(requiredChannelPermissions, false)
				.map((permission) => `'${permission}'`);
			const MESSAGE = `missing ${commaListAnd(missingChannelPermissions)} permission${
				missingChannelPermissions.length === 1 ? '' : 's'
			} in ${this.channelName(channel)}`;

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
