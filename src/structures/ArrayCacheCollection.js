'use strict';

const { Collection } = require('discord.js');

module.exports = class ArrayCacheCollection extends Collection {
	constructor(iterable) {
		super(iterable);

		/**
		 * Cached array for the `array()` method - will be reset to `null` whenever `set()` or `delete()` are called
		 * @name Collection#_array
		 * @type {?Array}
		 * @private
		 */
		Object.defineProperty(this, '_array', { value: null, writable: true, configurable: true });

		/**
		  * Cached array for the `keyArray()` method - will be reset to `null` whenever `set()` or `delete()` are called
		  * @name Collection#_keyArray
		  * @type {?Array}
		  * @private
		  */
		Object.defineProperty(this, '_keyArray', { value: null, writable: true, configurable: true });
	}

	/**
	 * Identical to [Map.set()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/set).
	 * Sets a new element in the collection with the specified key and value.
	 * @param {*} key - The key of the element to add
	 * @param {*} value - The value of the element to add
	 * @returns {Collection}
	 */
	set(key, value) {
		this._array = null;
		this._keyArray = null;
		return super.set(key, value);
	}

	/**
	 * Identical to [Map.delete()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/delete).
	 * Deletes an element from the collection.
	 * @param {*} key - The key to delete from the collection
	 * @returns {boolean} `true` if the element was removed, `false` if the element does not exist.
	 */
	delete(key) {
		this._array = null;
		this._keyArray = null;
		return super.delete(key);
	}

	/**
	 * Creates an ordered array of the values of this collection, and caches it internally. The array will only be
	 * reconstructed if an item is added to or removed from the collection, or if you change the length of the array
	 * itself. If you don't want this caching behavior, use `[...collection.values()]` or
	 * `Array.from(collection.values())` instead.
	 * @returns {Array}
	 */
	array() {
		if (this._array?.length !== this.size) this._array = [ ...this.values() ];
		return this._array;
	}

	/**
	 * Creates an ordered array of the keys of this collection, and caches it internally. The array will only be
	 * reconstructed if an item is added to or removed from the collection, or if you change the length of the array
	 * itself. If you don't want this caching behavior, use `[...collection.keys()]` or
	 * `Array.from(collection.keys())` instead.
	 * @returns {Array}
	 */
	keyArray() {
		if (this._keyArray?.length !== this.size) this._keyArray = [ ...this.keys() ];
		return this._keyArray;
	}

	/**
	 * The sort method sorts the items of a collection in place and returns it.
	 * The sort is not necessarily stable in Node 10 or older.
	 * The default sort order is according to string Unicode code points.
	 * @param {Function} [compareFunction] Specifies a function that defines the sort order.
	 * If omitted, the collection is sorted according to each character's Unicode code point value,
	 * according to the string conversion of each element.
	 * @returns {Collection}
	 * @example collection.sort((userA, userB) => userA.createdTimestamp - userB.createdTimestamp);
	 */
	sort(compareFunction) {
		this._array = null;
		this._keyArray = null;
		return super.sort(compareFunction);
	}
};
