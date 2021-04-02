'use strict';
const { createClient } = require('redis');
const { LB_KEY } = require('../constants/redis');
const logger = require('../functions/logger');


class RedisListener {
	/**
	 * @param {import('./LunarClient')} client
	 */
	constructor(client, ...args) {
		this.client = client;
		this.redis = createClient(...args);
		this.namespace = process.env.NAMESPACE;
		this.keyRegExp = new RegExp(`^${[ process.env.namespace, '(?<type>.+)', '(?:.+:)*', '(?<guildID>.+)', '(?<channelID>\\d+)', '(?<messageID>\\d+)' ].join(':')}$`);

		this.redis.config('set', 'notify-keyspace-events', 'Exe');

		// redisClient.subscribe('__keyevent@0__:del'); // add 'g' to config to enable
		this.redis.subscribe('__keyevent@0__:expired');
		this.redis.subscribe('__keyevent@0__:evicted');

		this.redis.on('error', logger.error);
		this.redis.on('message', this.onMessage.bind(this));
	}

	/**
	 * callback for the 'message' event
	 * @param {string} channel redis channel
	 * @param {string} key redis key
	 */
	async onMessage(channel, key) {
		if (this.client.config.get('EXTENDED_LOGGING_ENABLED')) logger.debug({ channel, key });

		const keyMatched = key.match(this.keyRegExp);

		if (keyMatched) {
			const { groups: { type, channelID, messageID } } = keyMatched;

			switch (type) {
				case LB_KEY: {
					try {
						/** @type {import('./extensions/Message')} */
						const message = await (await this.client.channels.fetch(channelID)).messages.fetch(messageID);

						if (message.channel.checkBotPermissions('MANAGE_MESSAGES')) {
							await message.reactions.removeAll();
						} else {
							await Promise.all(message.reactions.cache.map(async reaction => reaction.users.remove()));
						}
					} catch (error) {
						logger.error(error);
					}

					break;
				}
			}
		}
	}
}

module.exports = RedisListener;
