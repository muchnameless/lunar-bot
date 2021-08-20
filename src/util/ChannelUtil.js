import { Permissions } from 'discord.js';
import { commaListsAnd } from 'common-tags';
import { logger } from '../functions/index.js';


export default class ChannelUtil extends null {
	static DM_PERMISSIONS = new Permissions();
	static DEFAULT_SEND_PERMISSIONS = Permissions.FLAGS.VIEW_CHANNEL | Permissions.FLAGS.SEND_MESSAGES;

	/**
	 * @param {?import('discord.js').Channel} channel
	 */
	static logInfo(channel) {
		if (!channel) return null;

		switch (channel.type) {
			case 'DM':
				return `#${channel.recipient?.tag ?? `DM-${channel.recipient.id}`}`;

			default:
				return `#${channel.name}`;
		}
	}

	/**
	 * @param {?import('discord.js').Channel} channel
	 * @returns {?Readonly<Permissions>}
	 */
	static botPermissions(channel) {
		if (!channel) return null;

		switch (channel.type) {
			case 'DM':
				return this.DM_PERMISSIONS;

			default:
				return channel.permissionsFor(channel.guild.me);
		}
	}

	/**
	 * wether the channel is a ticket channel
	 * @param {import('discord.js').Channel} channel
	 */
	static isTicket(channel) {
		switch (channel.type) {
			case 'DM':
				return false;

			default:
				return channel.parentId === channel.client.config.get('TICKET_CHANNELS_CATEGORY_ID') && /-\d+$/.test(channel.name);
		}
	}

	/**
	 * deletes all provided messages from the channel with as few API calls as possible
	 * @param {import('discord.js').TextBasedChannels} channel
	 * @param {string|string[]} IdOrIds
	 */
	static async deleteMessages(channel, IdOrIds) {
		try {
			switch (channel.type) {
				case 'DM':
					if (Array.isArray(IdOrIds)) return await Promise.all(IdOrIds.map(async id => channel.messages.delete(id)));

					return await channel.messages.delete(IdOrIds);

				default: {
					if (Array.isArray(IdOrIds)) {
						if (this.botPermissions(channel).has(Permissions.FLAGS.MANAGE_MESSAGES)) return await channel.bulkDelete(IdOrIds);

						return await Promise.all(IdOrIds.map(async (id) => {
							const message = channel.messages.cache.get(id);

							if (message?.deleted || !(message?.deletable ?? true)) return;

							return await channel.messages.delete(id);
						}));
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
	 * @param {import('discord.js').TextBasedChannels} channel
	 * @param {string | import('discord.js').MessageOptions} contentOrOptions
	 */
	static async send(channel, contentOrOptions) {
		// guild -> requires permission
		let requiredChannelPermissions = this.DEFAULT_SEND_PERMISSIONS;

		if (Reflect.has(contentOrOptions, 'embeds')) requiredChannelPermissions |= Permissions.FLAGS.EMBED_LINKS;
		if (Reflect.has(contentOrOptions, 'files')) requiredChannelPermissions |= Permissions.FLAGS.ATTACH_FILES;

		// permission checks
		if (!this.botPermissions(channel).has(requiredChannelPermissions)) {
			const missingChannelPermissions = this.botPermissions(channel)
				.missing(requiredChannelPermissions)
				.map(permission => `'${permission}'`);
			const errorMessage = commaListsAnd`missing ${missingChannelPermissions} permission${missingChannelPermissions.length === 1 ? '' : 's'} in`;

			return logger.warn(`${errorMessage} #${channel.name}`);
		}

		try {
			return await channel.send(contentOrOptions);
		} catch (error) {
			return logger.error(error);
		}
	}
}

ChannelUtil.DM_PERMISSIONS
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
