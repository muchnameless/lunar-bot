'use strict';

const BaseClientCollection = require('./BaseClientCollection');


class CooldownCollection extends BaseClientCollection {
	constructor(client, entries = null) {
		super(client, entries);
	}
}

module.exports = CooldownCollection;
