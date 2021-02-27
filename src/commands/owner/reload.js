'use strict';

const { basename } = require('path');
const { getAllJsFiles } = require('../../functions/files');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class ReloadCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'r', 'load' ],
			description: '(re)load a command',
			args: true,
			usage: '[`command name` to reload, `all`|`commands` for all commands, `database`|`db` cache, `cooldown(s)`]',
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/LunarClient')} client
	 * @param {import('../../structures/database/managers/ConfigManager')} config
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(client, config, message, args, flags, rawArgs) {
		const INPUT = args[0].toLowerCase();

		switch (INPUT) {
			case 'all':
			case 'commands':
				await client.commands.unloadAll().loadAll();
				return message.reply(`${client.commands.size} command${client.commands.size !== 1 ? 's' : ''} were reloaded successfully.`);

			case 'db':
			case 'database':
				await client.db.loadCache();
				return message.reply('database cache reloaded successfully.');

			case 'cooldown':
			case 'cooldowns':
				client.commands.cooldowns.clear();
				return message.reply('cooldowns reset successfully.');

			default: {
				const command = client.commands.getByName(INPUT);

				let commandName;

				if (command) {
					command.unload();
					commandName = command.name.toLowerCase();
				} else {
					commandName = INPUT;
				}

				try {
					const commandFiles = await getAllJsFiles(client.commands.dirPath);
					const NEW_PATH = commandFiles.find(file => basename(file, '.js').toLowerCase() === commandName);

					if (!NEW_PATH) return message.reply(`no command with the name or alias \`${INPUT}\` found`);

					client.commands.load(NEW_PATH);

					logger.info(`command ${commandName} was reloaded successfully`);
					return message.reply(`command \`${commandName}\` was reloaded successfully.`);
				} catch (error) {
					logger.error('An error occurred while reloading:\n', error);
					return message.reply(`an error occurred while reloading \`${commandName}\`:\n\`\`\`xl\n${error.message}\`\`\``);
				}
			}
		}
	}
};
