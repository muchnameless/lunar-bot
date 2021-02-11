'use strict';

const ms = require('ms');
const logger = require('../../functions/logger');
const BaseClientCollection = require('./BaseClientCollection');


class BannedUserCollection extends BaseClientCollection {
	constructor(client, entries = null) {
		super(client, entries);
	}

	// prevent a discord user from using the bot
	async add(user, options = {}) {
		const { reason = null, expiresAt = Infinity } = options;

		if (this.has(user.id)) {
			const bannedUser = this.get(user.id);

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
			const newBannedUser = await this.client.db.BannedUser.create({
				discordID: user.id,
				discordTag: user.tag,
				reason: reason,
				expiresAt: expiresAt,
			});

			this.set(user.id, newBannedUser);
			return `successfully banned \`${user.tag}\` from using ${this.user} ${expiresAt === Infinity ? 'indefinitely' : `for ${ms(expiresAt - Date.now(), { long: true })}`}. Reason: ${reason?.length ? reason : 'no reason specified'}.`;
		} catch (error) {
			logger.error(error);
			return `an error occurred while trying to ban \`${user.tag}\` from using ${this.user}.`;
		}
	}

	// allow a discord user to use the bot again
	async remove(user) {
		if (!this.has(user.id)) return `\`${user.tag}\` is not on the ban list.`;

		try {
			await this.get(user.id).destroy();
			this.delete(user.id);
			return `successfully unbanned \`${user.tag}\` from using ${this.user}.`;
		} catch (error) {
			logger.error(error);
			return `an error occurred while trying to unban \`${user.tag}\` from using ${this.user}.`;
		}
	}
}

module.exports = BannedUserCollection;
