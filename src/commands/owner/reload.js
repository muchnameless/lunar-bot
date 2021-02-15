'use strict';

const path = require('path');
const { getAllJsFiles } = require('../../functions/files');
const Command = require('../../structures/Command');
const logger = require('../../functions/logger');


module.exports = class ReloadCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'r', 'load' ],
			description: 'reload a required .js file',
			args: true,
			usage: '[`command name` to reload, `all`|`commands` for all commands, `database`|`db` cache, `cooldown(s)`]',
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/LunarClient')} client
	 * @param {import('../../structures/database/ConfigHandler')} config
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(client, config, message, args, flags, rawArgs) {
		const INPUT = args[0].toLowerCase();
		const command = client.commands.getByName(INPUT);

		if (command) {
			const OLD_PATH = Object.keys(require.cache)
				.filter(key => key.includes('commands'))
				.find(key => key.includes(command.name));

			delete require.cache[OLD_PATH];

			try {
				const commandFiles = getAllJsFiles(path.join(__dirname, '..'));
				const nameRegex = new RegExp(command.name, 'i');
				const NEW_PATH = commandFiles.find(file => nameRegex.test(file));

				client.commands.delete(command.name);
				client.commands.load(NEW_PATH);

				logger.info(`command ${command.name} was reloaded successfully`);
				return message.reply(`command \`${command.name}\` was reloaded successfully.`);
			} catch (error) {
				logger.error('An error occurred while reloading:\n', error);
				return message.reply(`an error occurred while reloading \`${command.name}\`:\n\`\`\`xl\n${error.message}\`\`\``);
			}
		}

		switch (INPUT) {
			case 'all':
			case 'commands':
				client.commands.clear();
				Object.keys(require.cache).filter(key => /[/\\]commands[/\\]\D+[/\\]\D+\.js/.test(key)).forEach(file => delete require.cache[file]);
				client.commands.loadAll();
				return message.reply(`${client.commands.size} command${client.commands.size !== 1 ? 's' : ''} were reloaded successfully.`);

			case 'db':
			case 'database':
				await client.db.loadCache();
				return message.reply('database cache reloaded successfully.');

			case 'cooldown':
			case 'cooldowns':
				client.cooldowns.clear();
				return message.reply('cooldowns reset successfully.');

			default:
				message.reply(`no command with the name or alias \`${INPUT}\`.`);
		}
	}
};
