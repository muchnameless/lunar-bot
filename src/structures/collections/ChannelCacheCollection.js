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
module.exports = class ChannelCacheCollection extends Collection {
	/**
	 * @param {import('discord.js').Snowflake} key
	 * @param {import('discord.js').Channel} value
	 */
	set(key, value) {
		if (!value.isText() && value.type !== 'GUILD_CATEGORY') return this;

		return super.set(key, value);
	}

	static get [Symbol.species]() {
		return Collection;
	}
};
