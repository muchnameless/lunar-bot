import { Permissions } from 'discord.js';
import { commaListsAnd } from 'common-tags';
import { logger } from '../functions';
import type {
	Channel,
	DMChannel,
	GuildChannel,
	Message,
	MessageOptions,
	PartialDMChannel,
	Snowflake,
	TextBasedChannels,
} from 'discord.js';
import type { LunarClient } from '../structures/LunarClient';

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
	 * wether the channel is a ticket channel
	 * @param channel
	 */
	static isTicket(channel: Channel) {
		switch (channel.type) {
			case 'DM':
				return false;

			default:
				return (
					(channel as GuildChannel).parentId ===
						(channel.client as LunarClient).config.get('TICKET_CHANNELS_CATEGORY_ID') &&
					/-\d+$/.test((channel as GuildChannel).name)
				);
		}
	}

	/**
	 * deletes all provided messages from the channel with as few API calls as possible
	 * @param channel
	 * @param IdOrIds
	 */
	static async deleteMessages(channel: TextBasedChannels | null, IdOrIds: Snowflake | Snowflake[]) {
		if (!channel?.isText())
			return logger.warn(`[DELETE MESSAGES]: ${this.logInfo(channel)} is not a text based channel`);

		try {
			switch (channel.type) {
				case 'DM':
					if (Array.isArray(IdOrIds)) return await Promise.all(IdOrIds.map((id) => channel.messages.delete(id)));

					return await channel.messages.delete(IdOrIds);

				default: {
					if (Array.isArray(IdOrIds)) {
						if (this.botPermissions(channel).has(Permissions.FLAGS.MANAGE_MESSAGES))
							return await channel.bulkDelete(IdOrIds);

						return await Promise.all(
							IdOrIds.map((id) => {
								const message = channel.messages.cache.get(id);

								if (message?.deleted || !(message?.deletable ?? true)) return null;

								return channel.messages.delete(id);
							}),
						);
					}

					const message = channel.messages.cache.get(IdOrIds);

					if (message?.deleted || !(message?.deletable ?? true)) return;

					return await channel.messages.delete(IdOrIds);
				}
			}
		} catch (error) {
			return logger.error(error);
		}
	}

	/**
	 * @param channel
	 * @param contentOrOptions
	 */
	static async send(
		channel: TextBasedChannels,
		contentOrOptions: SendOptions & { rejectOnError: true },
	): Promise<Message>;
	static async send(channel: TextBasedChannels, contentOrOptions: string | SendOptions): Promise<Message | null>;
	static async send(channel: TextBasedChannels, contentOrOptions: string | SendOptions) {
		// guild -> requires permission
		let requiredChannelPermissions = this.DEFAULT_SEND_PERMISSIONS;

		if (typeof contentOrOptions !== 'string') {
			if (Reflect.has(contentOrOptions, 'reply')) requiredChannelPermissions |= Permissions.FLAGS.READ_MESSAGE_HISTORY;
			if (Reflect.has(contentOrOptions, 'embeds')) requiredChannelPermissions |= Permissions.FLAGS.EMBED_LINKS;
			if (Reflect.has(contentOrOptions, 'files')) requiredChannelPermissions |= Permissions.FLAGS.ATTACH_FILES;
		}

		// permission checks
		if (!this.botPermissions(channel).has(requiredChannelPermissions)) {
			const missingChannelPermissions = this.botPermissions(channel)
				.missing(requiredChannelPermissions)
				.map((permission) => `'${permission}'`);

			if (typeof contentOrOptions !== 'string' && contentOrOptions.rejectOnError)
				throw new Error(
					commaListsAnd`[CHANNEL UTIL]: missing ${missingChannelPermissions} permission${
						missingChannelPermissions?.length === 1 ? '' : 's'
					} in ${this.logInfo(channel)}`,
				);
			logger.warn(
				commaListsAnd`[CHANNEL UTIL]: missing ${missingChannelPermissions} permission${
					missingChannelPermissions?.length === 1 ? '' : 's'
				} in ${this.logInfo(channel)}`,
			);
			return null;
		}

		try {
			return await channel.send(contentOrOptions);
		} catch (error) {
			if (typeof contentOrOptions !== 'string' && contentOrOptions.rejectOnError) throw error;
			logger.error(error);
			return null;
		}
	}
}
