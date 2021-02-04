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
	help(message, args, flags) {
		return this.get('help').execute(message, args, flags);
	}
}

module.exports = CommandCollection;
