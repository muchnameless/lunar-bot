'use strict';

const Command = require('../../structures/commands/Command');
// const logger = require('../../functions/logger');


module.exports = class UnloadCommand extends Command {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [],
			description: 'unload a command',
			args: true,
			usage: '[`command name` to unload]',
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 */
	async run(message, args) { // eslint-disable-line no-unused-vars
		const INPUT = args[0].toLowerCase();
		const command = this.collection.getByName(INPUT);

		if (!command) return message.reply(`no command with the name or alias \`${INPUT}\` found`);

		command.unload();

		message.reply(`command \`${command.name}\` was unloaded successfully`);
	}
};
