'use strict';

const { Collection } = require('discord.js');
// const logger = require('../../functions/logger');

/**
 * A Collection which holds a max amount of entries. The first key is deleted if the Collection has
 * reached max size.
 * @extends {Collection}
 * @param {number} [maxSize=0] The maximum size of the Collection
 * @param {Iterable} [iterable=null] Optional entries passed to the Map constructor.
 */
module.exports = class MessageCacheCollection extends Collection {
	constructor(maxSize = 0, iterable = null) {
		super(iterable);
		/**
		 * The max size of the Collection.
		 * @type {number}
		 */
		this.maxSize = maxSize;
	}

	/**
	 * @param {import('discord.js').Snowflake} key
	 * @param {import('./extensions/Message')} value
	 */
	set(key, value) {
		if (value.channel.id === value.client.config.get('TAX_CHANNEL_ID')) { // only cache own messages in taxChannel (taxMessage)
			if (!value.me) return this;
		} else if (!value.client.chatBridges.channelIds.has(value.channel.id) && value.channel.id !== value.client.config.get('GUILD_ANNOUNCEMENTS_CHANNEL_ID')) { // only cache messages in guild announcements and bridge channels
			return this;
		}

		if (this.maxSize === 0) return this;
		if (this.size >= this.maxSize && !this.has(key)) this.delete(this.firstKey());
		return super.set(key, value);
	}

	static get [Symbol.species]() {
		return Collection;
	}
};
