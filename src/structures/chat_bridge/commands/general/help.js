'use strict';

const { commaListsOr } = require('common-tags');
const ms = require('ms');
const BridgeCommand = require('../../../commands/BridgeCommand');
// const logger = require('../../../../functions/logger');


module.exports = class HelpBridgeCommand extends BridgeCommand {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [ 'h' ],
			description: 'list of all commands or info about a specific command',
			usage: '<`command`|`category` name>',
			cooldown: 1,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../HypixelMessage')} message message that triggered the command
	 * @param {string[]} args command arguments
	 */
	async runInGame(message, args) { // eslint-disable-line no-unused-vars
		// default help
		if (!args.length) {
			const reply = [ `gchat prefix: ${[ this.config.get('PREFIX'), this.config.get('INGAME_PREFIX'), `@${message.chatBridge.bot.ign}` ].join(', ')}` ];

			for (const category of this.collection.visibleCategories) {
				reply.push(`${category}: ${[ ...this.collection.filterByCategory(category).keys() ].join(', ')}`);
			}

			return message.author.send(reply.join('\n'));
		}

		const INPUT = args[0].toLowerCase();


		// category help
		const requestedCategory = this.collection.categories.find(categoryName => categoryName === INPUT);

		if (requestedCategory) {
			const reply = [ `Category: ${INPUT}` ];
			const categoryCommands = this.collection.filterByCategory(INPUT);
			const { requiredRoles } = categoryCommands.first();

			if (requiredRoles) {
				reply.push(commaListsOr`Required Roles: ${requiredRoles.map(roleId => this.client.lgGuild?.roles.cache.get(roleId)?.name ?? roleId)}`);
			} else if (INPUT === 'owner') {
				reply.push(`Required ID: ${this.client.ownerId}`);
			}

			reply.push(`Commands: ${[ ...categoryCommands.keys() ].join(', ')}`);

			return message.author.send(reply.join('\n'));
		}


		// single command help
		const command = this.collection.getByName(INPUT);

		if (!command) return message.author.send(`'${INPUT}' is neither a valid command nor category`);

		const reply = [ `Name: ${command.name}` ];

		if (command.aliases) reply.push(`Aliases: ${command.aliases.join(', ')}`);

		reply.push(`Category: ${command.category}`);

		const { requiredRoles } = command;

		if (requiredRoles) {
			reply.push(commaListsOr`Required Roles: ${requiredRoles.map(roleId => this.client.lgGuild?.roles.cache.get(roleId)?.name ?? roleId)}`);
		} else if (INPUT === 'owner') {
			reply.push(`Required ID: ${this.client.ownerId}`);
		}

		if (command.description) reply.push(`Description: ${command.description}`);
		if (command.usage) reply.push(`Usage: ${command.usageInfo}`);

		reply.push(`Cooldown: ${ms((command.cooldown ?? this.config.get('COMMAND_COOLDOWN_DEFAULT')) * 1_000, { long: true })}`);

		return message.author.send(reply.join('\n'));
	}
};
