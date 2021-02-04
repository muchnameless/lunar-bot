'use strict';

const BaseClientCollection = require('./BaseClientCollection');


class CommandCollection extends BaseClientCollection {
	constructor(client, entries = null) {
		super(client, entries);
	}

	// get a command by name or by alias
	getByName(name) {
		return this.get(name) ?? this.find(cmd => cmd.aliases?.includes(name));
	}

	// execute the help command
	help(...args) {
		return this.get('help').run(...args);
	}
}

module.exports = CommandCollection;
