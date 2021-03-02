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
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(message, args, flags, rawArgs) {
		const INPUT = args[0].toLowerCase();

		switch (INPUT) {
			case 'all':
			case 'commands':
				await this.commandCollection.unloadAll().loadAll();
				return message.reply(`${this.commandCollection.size} command${this.commandCollection.size !== 1 ? 's' : ''} were reloaded successfully.`);

			case 'db':
			case 'database':
				await this.client.db.loadCache();
				return message.reply('database cache reloaded successfully.');

			case 'cooldown':
			case 'cooldowns':
				this.commandCollection.cooldowns.clear();
				return message.reply('cooldowns reset successfully.');

			default: {
				let commandName = INPUT;

				try {
					const commandFiles = await getAllJsFiles(this.commandCollection.dirPath);

					// try to find file with INPUT name
					let commandFile = commandFiles.find(file => basename(file, '.js').toLowerCase() === commandName);
					let command;

					// no file found
					if (!commandFile) {
						// try to autocorrect input
						command = this.commandCollection.getByName(commandName);

						if (command) {
							commandName = command.name;
							commandFile = commandFiles.find(file => basename(file, '.js').toLowerCase() === commandName);
						}

					// file with exact name match found
					} else {
						commandName = basename(commandFile, '.js').toLowerCase();
						command = this.commandCollection.get(commandName); // try to find already loaded command
					}

					if (!commandFile) return message.reply(`no command with the name or alias \`${INPUT}\` found`);

					// command already loaded
					if (command) {
						command.unload();
						commandName = command.name;
					}

					this.commandCollection.load(commandFile);

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
