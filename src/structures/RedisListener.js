'use strict';
const Redis = require('ioredis');
const { LB_KEY, DM_KEY } = require('../constants/redis');
const logger = require('../functions/logger');


module.exports = class RedisListener {
	/**
	 * @param {import('./LunarClient')} client
	 */
	constructor(client, ...args) {
		this.client = client;
		this.redis = new Redis(...args);

		this.redis.config('set', 'notify-keyspace-events', 'Exe');

		// redisClient.subscribe('__keyevent@0__:del'); // add 'g' to config to enable
		this.redis.subscribe('__keyevent@0__:expired');
		this.redis.subscribe('__keyevent@0__:evicted');

		this.redis.on('error', logger.error);
		this.redis.on('message', this.onMessage.bind(this));
	}

	static NAMESPACE = process.env.NAMESPACE;

	static keyRegExp = new RegExp(`^${[ this.NAMESPACE, '(?<type>.+)(?::.+)*', `(?<guildID>${DM_KEY}|\\d{17,19})`, '(?<channelID>\\d{17,19})', '(?<messageID>\\d{17,19})' ].join(':')}$`);

	/**
	 * callback for the 'message' event
	 * @param {string} channel redis channel
	 * @param {string} key redis key
	 */
	async onMessage(channel, key) {
		if (this.client.config.getBoolean('EXTENDED_LOGGING_ENABLED')) logger.debug({ channel, key });

		const keyMatched = key.match(RedisListener.keyRegExp);

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
};
