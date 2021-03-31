'use strict';

const { commaListsOr } = require('common-tags');
const ms = require('ms');
const HelpCommand = require('../../../../commands/general/help');
// const logger = require('../../../../functions/logger');


module.exports = class BridgeHelpCommand extends HelpCommand {
	/**
	 * execute the command
	 * @param {import('../../HypixelMessage')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(message, args, flags, rawArgs) { // eslint-disable-line no-unused-vars
		// default help
		if (!args.length) {
			const reply = [ `gchat prefix: ${[ this.config.get('PREFIX'), this.config.get('INGAME_PREFIX'), `@${message.chatBridge.bot.username}` ].join(', ')}` ];

			for (const category of this.commandCollection.visibleCategories) {
				reply.push(`${category}: ${[ ...this.commandCollection.filterByCategory(category).keys() ].join(', ')}`);
			}

			return message.reply(reply.join('\n'));
		}

		const INPUT = args[0].toLowerCase();


		// category help
		const requestedCategory = this.commandCollection.categories.find(categoryName => categoryName === INPUT);

		if (requestedCategory) {
			const reply = [ `Category: ${INPUT}` ];
			const categoryCommands = this.commandCollection.filterByCategory(INPUT);
			const { requiredRoles } = categoryCommands.first();

			if (requiredRoles) {
				reply.push(commaListsOr`Required Roles: ${requiredRoles.map(roleID => this.client.lgGuild?.roles.cache.get(roleID)?.name ?? roleID)}`);
			} else if (INPUT === 'owner') {
				reply.push(`Required ID: ${this.client.ownerID}`);
			}

			reply.push(`Commands: ${[ ...categoryCommands.keys() ].join(', ')}`);

			return message.reply(reply.join('\n'));
		}


		// single command help
		const command = this.commandCollection.getByName(INPUT);

		if (!command) return message.reply(`'${INPUT}' is neither a valid command nor category`);

		const reply = [ `Name: ${command.name}` ];

		if (command.aliases) reply.push(`Aliases: ${command.aliases.join(', ')}`);

		reply.push(`Category: ${command.category}`);

		const { requiredRoles } = command;

		if (requiredRoles) {
			reply.push(commaListsOr`Required Roles: ${requiredRoles.map(roleID => this.client.lgGuild?.roles.cache.get(roleID)?.name ?? roleID)}`);
		} else if (INPUT === 'owner') {
			reply.push(`Required ID: ${this.client.ownerID}`);
		}

		if (command.description) reply.push(`Description: ${command.description}`);
		if (command.usage) reply.push(`Usage: ${command.usageInfo}`);

		reply.push(`Cooldown: ${ms((command.cooldown ?? this.config.getNumber('COMMAND_COOLDOWN_DEFAULT')) * 1_000, { long: true })}`);

		message.reply(reply.join('\n'));
	}
};
