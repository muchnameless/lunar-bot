'use strict';

const { Collection } = require('discord.js');
// const LunarClient = require('../LunarClient');


class BaseClientCollection extends Collection {
	/**
	 * @param {LunarClient} client 
	 */
	constructor(client, entries = null) {
		super(entries);
		this.client = client;
	}

	/**
	 * calls super.set()
	 * @param {string} key
	 * @param {any} value
	 */
	_set(key, value) {
		return super.set(key, value);
	}

	sort(compareFunction) {
		return super.sort(compareFunction);
	}

	/**
	 * below methods all use this.contructor and have ot be overwritten because of that since the constructor arguments changed (client as first parameter)
	 * and a similar thing for all methods containing set replaced with _set, so I can easily overwrite set in child classes without it breaking other methods
	 */

	filter(fn, thisArg) {
		if (typeof thisArg !== 'undefined') fn = fn.bind(thisArg);
		const results = new this.constructor[Symbol.species](this.client);
		for (const [ key, val ] of this) {
			if (fn(val, key, this)) results._set(key, val);
		}
		return results;
	}

	partition(fn, thisArg) {
		if (typeof thisArg !== 'undefined') fn = fn.bind(thisArg);
		const results = [ new this.constructor[Symbol.species](this.client), new this.constructor[Symbol.species](this.client) ];
		for (const [ key, val ] of this) {
			if (fn(val, key, this)) {
				results[0]._set(key, val);
			} else {
				results[1]._set(key, val);
			}
		}
		return results;
	}

	flatMap(fn, thisArg) {
		const collections = this.map(fn, thisArg);
		return (new this.constructor[Symbol.species](this.client)).concat(...collections);
	}

	mapValues(fn, thisArg) {
		if (typeof thisArg !== 'undefined') fn = fn.bind(thisArg);
		const coll = new this.constructor[Symbol.species](this.client);
		for (const [ key, val ] of this) coll._set(key, fn(val, key, this));
		return coll;
	}

	sorted(compareFunction = (x, y) => Number(x > y) || Number(x === y) - 1) {
		return this.clone().sort((av, bv, ak, bk) => compareFunction(av, bv, ak, bk));
	}

	clone() {
		return new this.constructor[Symbol.species](this.client, [ ...this.entries() ]);
	}

	concat(...collections) {
		const newColl = this.clone();
		for (const coll of collections) {
			for (const [ key, val ] of coll) newColl._set(key, val);
		}
		return newColl;
	}
}

module.exports = BaseClientCollection;
