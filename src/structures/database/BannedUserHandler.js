'use strict';

const ms = require('ms');
const ModelHandler = require('./ModelHandler');
const logger = require('../../functions/logger');


class BannedUserHandler extends ModelHandler {
	constructor(options) {
		super(options);

		/**
		 * @type {import('discord.js').Collection<string, import('./models/BannedUser')>}
		 */
		this.cache;
		/**
		 * @type {import('./models/BannedUser')}
		 */
		this.model;
	}

	/**
	 * prevent a discord user from using the bot
	 * @param {import('discord.js').User} user to ban
	 * @param {object} options
	 * @param {?string} [options.reason]
	 * @param {number} [options.expiresAt]
	 */
	async add(user, { reason = null, expiresAt = Infinity } = {}) {
		const bannedUser = this.cache.get(user.id);

		if (bannedUser) {
			try {
				if (reason) bannedUser.reason = reason;
				bannedUser.expiresAt = expiresAt;
				await bannedUser.save();

				return `\`${user.tag}\` is now banned ${bannedUser.expiresAt === Infinity ? 'indefinitely' : `for ${ms(bannedUser.expiresAt - Date.now(), { long: true })}`}. Reason: ${bannedUser.reason?.length ? bannedUser.reason : 'no reason specified'}.`;
			} catch (error) {
				return `an error occurred while trying to update the ban from \`${user.tag}\` from using ${this.user}.`;
			}
		}

		try {
			await super.add({
				discordID: user.id,
				discordTag: user.tag,
				reason: reason,
				expiresAt: expiresAt,
			});

			return `successfully banned \`${user.tag}\` from using ${this.user} ${expiresAt === Infinity ? 'indefinitely' : `for ${ms(expiresAt - Date.now(), { long: true })}`}. Reason: ${reason?.length ? reason : 'no reason specified'}.`;
		} catch (error) {
			logger.error(error);
			return `an error occurred while trying to ban \`${user.tag}\` from using ${this.user}.`;
		}
	}

	/**
	 * allow a discord user to use the bot again
	 * @param {import('discord.js').User} user
	 */
	async remove(user) {
		if (!this.cache.has(user.id)) return `\`${user.tag}\` is not on the ban list.`;

		try {
			await this.cache.get(user.id).destroy();
			this.cache.delete(user.id);

			return `successfully unbanned \`${user.tag}\` from using ${this.user}.`;
		} catch (error) {
			logger.error(error);
			return `an error occurred while trying to unban \`${user.tag}\` from using ${this.user}.`;
		}
	}
}

module.exports = BannedUserHandler;
