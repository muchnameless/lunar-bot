'use strict';

const { commaListsOr } = require('common-tags');
const ms = require('ms');
const IngameCommand = require('../../IngameCommand');
const logger = require('../../../../functions/logger');


module.exports = class HelpCommand extends IngameCommand {
	constructor(data) {
		super(data, {
			aliases: [ 'h' ],
			description: 'list of all commands or info about a specific command',
			usage: '<\'command\'|\'category\' name>',
			cooldown: 1,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../../LunarClient')} client
	 * @param {import('../../../database/managers/ConfigManager')} config
	 * @param {import('../../HypixelMessage')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(client, config, message, args, flags, rawArgs) {
		const { commands } = client.chatBridges;

		// default help
		if (!args.length) {
			const reply = [ `gchat prefix: ${[ config.get('PREFIX'), config.get('INGAME_PREFIX'), `@${message.chatBridge.bot.username}` ].join(', ')}` ];

			for (const category of commands.visibleCategories) {
				reply.push(`${category}: ${[ ...commands.filterByCategory(category).keys() ].join(', ')}`);
			}

			return message.reply(reply.join('\n'));
		}

		const INPUT = args[0].toLowerCase();


		// category help
		const requestedCategory = commands.categories.find(categoryName => categoryName === INPUT);

		if (requestedCategory) {
			const reply = [ `Category: ${INPUT}` ];
			const categoryCommands = commands.filterByCategory(INPUT);
			const requiredRoles = categoryCommands.first().requiredRoles;

			if (requiredRoles) {
				reply.push(commaListsOr`Required Roles: ${requiredRoles.map(roleID => client.lgGuild?.roles.cache.get(roleID)?.name ?? roleID)}`);
			} else if (INPUT === 'owner') {
				reply.push(`Required ID: ${client.ownerID}`);
			}

			reply.push(`Commands: ${[ ...categoryCommands.keys() ].join(', ')}`);

			return message.reply(reply.join('\n'));
		}


		// single command help
		const command = commands.getByName(INPUT);

		if (!command) return message.reply(`'${INPUT}' is neither a valid command nor category`);

		const reply = [ `Name: ${command.name}` ];

		if (command.aliases) reply.push(`Aliases: ${command.aliases.join(', ')}`);

		reply.push(`Category: ${command.category}`);

		const requiredRoles = command.requiredRoles;

		if (requiredRoles) {
			reply.push(commaListsOr`Required Roles: ${requiredRoles.map(roleID => client.lgGuild?.roles.cache.get(roleID)?.name ?? roleID)}`);
		} else if (INPUT === 'owner') {
			reply.push(`Required ID: ${client.ownerID}`);
		}

		if (command.description) reply.push(command.description);
		if (command.usage) reply.push(`Usage: ${command.usageInfo}`);

		reply.push(`Cooldown: ${ms((command.cooldown ?? config.getNumber('COMMAND_COOLDOWN_DEFAULT')) * 1_000, { long: true })}`);

		message.reply(reply.join('\n'));
	}
};
