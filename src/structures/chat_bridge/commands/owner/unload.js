'use strict';

const IngameCommand = require('../../IngameCommand');
const logger = require('../../../../functions/logger');


module.exports = class UnloadCommand extends IngameCommand {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'unload a command',
			args: true,
			usage: '[\'command name\' to unload]',
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../../LunarClient')} client
	 * @param {import('../../../database/ConfigHandler')} config
	 * @param {import('../../HypixelMessage')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(client, config, message, args, flags, rawArgs) {
		const INPUT = args[0].toLowerCase();
		const command = client.chatBridges.commands.getByName(INPUT);

		if (!command) return message.reply(`no command with the name or alias '${INPUT}' found`);

		command.unload();

		message.reply(`command '${command.name}' was unloaded successfully`);
	}
};
