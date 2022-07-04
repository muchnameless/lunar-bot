import ms from 'ms';
import { BridgeCommand } from '#structures/commands/BridgeCommand';
import { commaListOr, seconds } from '#functions';
import type { CommandContext } from '#structures/commands/BaseCommand';
import type { Collection } from 'discord.js';
import type { DualCommand } from '#structures/commands/DualCommand';
import type { HypixelUserMessage } from '../../HypixelMessage';

export default class HelpBridgeCommand extends BridgeCommand {
	constructor(context: CommandContext) {
		super(context, {
			aliases: ['h'],
			description: 'list of all commands or info about a specific command',
			usage: '<`command`|`category` name>',
			cooldown: seconds(1),
		});
	}

	/**
	 * removes duplicates and lists the commands by name | aliases
	 * @param commands
	 */
	static listCommands(commands: Collection<string, BridgeCommand | DualCommand>) {
		return [...new Set(commands.values())]
			.map((command) =>
				[command.name, ...((command as DualCommand).aliasesInGame ?? command.aliases ?? [])].join(' | '),
			)
			.join(', ');
	}

	/**
	 * execute the command
	 * @param hypixelMessage
	 */
	override minecraftRun(hypixelMessage: HypixelUserMessage) {
		// default help
		if (!hypixelMessage.commandData.args.positionals.length) {
			const reply = [
				`Guild chat prefix: ${[...this.config.get('PREFIXES'), `@${hypixelMessage.chatBridge.bot!.username}`].join(
					', ',
				)}`,
				...this.collection.visibleCategories.map(
					(category) => `${category}: ${HelpBridgeCommand.listCommands(this.collection.filterByCategory(category))}`,
				),
			];

			return hypixelMessage.author.send(reply.join('\n'));
		}

		const INPUT = hypixelMessage.commandData.args.positionals[0]!.toLowerCase();

		// category help
		const requestedCategory = this.collection.categories.find((categoryName) => categoryName === INPUT);

		if (requestedCategory) {
			const reply = [`Category: ${INPUT}`];
			const categoryCommands = this.collection.filterByCategory(INPUT);
			const requiredRoles = categoryCommands
				.first()
				?.requiredRoles(hypixelMessage.hypixelGuild ?? hypixelMessage.player?.hypixelGuild);

			if (requiredRoles) {
				reply.push(
					`Required Roles: ${commaListOr(
						requiredRoles.map(
							(roleId) => hypixelMessage.hypixelGuild?.discordGuild?.roles.cache.get(roleId)?.name ?? roleId,
						),
					)}
					`,
				);
			} else if (INPUT === 'owner') {
				reply.push(`Required ID: ${this.client.ownerId}`);
			}

			reply.push(`Commands: ${HelpBridgeCommand.listCommands(categoryCommands)}`);

			return hypixelMessage.author.send(reply.join('\n'));
		}

		// single command help
		const command = this.collection.getByName(INPUT);

		if (!command) return hypixelMessage.author.send(`'${INPUT}' is neither a valid command nor category`);

		const reply = [`Name: ${command.name}`];

		if (command.aliases) reply.push(`Aliases: ${command.aliases.join(', ')}`);

		reply.push(`Category: ${command.category}`);

		const requiredRoles = command.requiredRoles(hypixelMessage.hypixelGuild ?? hypixelMessage.player?.hypixelGuild);

		if (requiredRoles) {
			reply.push(
				`Required Roles: ${commaListOr(
					requiredRoles.map(
						(roleId) => hypixelMessage.hypixelGuild?.discordGuild?.roles.cache.get(roleId)?.name ?? roleId,
					),
				)}
				`,
			);
		} else if (INPUT === 'owner') {
			reply.push(`Required ID: ${this.client.ownerId}`);
		}

		if (command.description) reply.push(`Description: ${command.description}`);
		if (command.usage) reply.push(`Usage: ${command.usageInfo}`);

		reply.push(`Cooldown: ${ms(command.cooldown ?? this.config.get('COMMAND_COOLDOWN_DEFAULT'), { long: true })}`);

		return hypixelMessage.author.send(reply.join('\n'));
	}
}
