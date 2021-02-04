'use strict';

const path = require('path');
const { getAllJsFiles } = require('../../functions/files');
const logger = require('../../functions/logger');


module.exports = {
	aliases: [ 'r', 'load' ],
	description: 'reload a required .js file',
	args: true,
	usage: '[`command name` to reload, `all`|`commands` for all commands, `database`|`db` cache, `cooldown(s)`]',
	cooldown: 0,
	execute: async (message, args, flags) => {
		const { client } = message;
		const INPUT = args[0].toLowerCase();
		const command = client.commands.getByName(INPUT);

		if (command) {
			const OLD_PATH = Object.keys(require.cache)
				.filter(key => key.includes('commands'))
				.find(key => key.includes(command.name));

			delete require.cache[OLD_PATH];

			try {
				const commandFiles = getAllJsFiles(path.join(__dirname, '..'));
				const nameRegex = new RegExp(command.name);
				const NEW_PATH = commandFiles.find(file => nameRegex.test(file));

				client.commands.delete(command.name);
				client.loadCommand(NEW_PATH);
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
				client.loadCommands();
				return message.reply(`${client.commands.size} command${client.commands.size !== 1 ? 's' : ''} were reloaded successfully.`);

			case 'db':
			case 'database':
				client.bannedUsers.clear();
				client.config.clear();
				client.hypixelGuilds.clear();
				client.players.clear();
				client.taxCollectors.clear();
				await client.loadDbCache();
				return message.reply('database cache reloaded successfully.');

			case 'cooldown':
			case 'cooldowns':
				client.cooldowns.clear();
				return message.reply('cooldowns reset successfully.');

			default:
				message.reply(`no command with the name or alias \`${INPUT}\`.`);
		}
	},
};
