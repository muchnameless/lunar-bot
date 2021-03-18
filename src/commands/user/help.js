'use strict';

const { MessageEmbed, version } = require('discord.js');
const { commaListsOr, stripIndents } = require('common-tags');
const ms = require('ms');
const { upperCaseFirstChar } = require('../../functions/util');
const Command = require('../../structures/commands/Command');
// const logger = require('../../functions/logger');


module.exports = class HelpCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'h' ],
			description: 'list of all commands or info about a specific command',
			usage: '<`command`|`category` name>',
			cooldown: 1,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(message, args, flags, rawArgs) { // eslint-disable-line no-unused-vars
		const { commands } = this.client;
		const helpEmbed = new MessageEmbed()
			.setColor(this.client.config.get('EMBED_BLUE'));


		// default help
		if (!args.length) {
			for (const category of commands.visibleCategories) {
				helpEmbed.addField(
					`${upperCaseFirstChar(category)} commands`,
					` • ${commands
						.filterByCategory(category)
						.map(command => [ command.name, command.aliases?.join(' | ') ].filter(Boolean).join(' | '))
						.join('\n • ')
					}`,
					true,
				);
			}

			helpEmbed
				.setAuthor('Simple Discord Bot by muchnameless#7217')
				.setDescription(stripIndents`
					List of all currently available commands and their aliases:
					Use \`${this.client.config.get('PREFIX')}\` or ${this.client.user} as prefix in servers.
					\u200b
				`)
				.padFields()
				.addField('\u200b', stripIndents`
					Use \`${this.client.config.get('PREFIX')}help <command/category name>\` to get additional information on a specific command/category.
					Arguments: \`[required]\` \`<optional>\`
					
					Feel free to tag me <@${this.client.ownerID}> with or DM me any bugs or feature requests.
				`)
				.setFooter(`Discord.js ${version}`)
				.setTimestamp();

			return message.reply(helpEmbed);
		}

		const INPUT = args[0].toLowerCase();


		// category help
		const requestedCategory = commands.categories.find(categoryName => categoryName === INPUT);

		if (requestedCategory) {
			const categoryCommands = commands.filterByCategory(INPUT);

			helpEmbed.setTitle(`Category: ${upperCaseFirstChar(INPUT)}`);

			let { requiredRoles } = categoryCommands.first();

			if (requiredRoles) {
				requiredRoles = requiredRoles.map(roleID => this.client.lgGuild?.roles.cache.get(roleID));
				helpEmbed.setDescription(stripIndents`
					**Required Roles:**
					${commaListsOr`${message.guild?.id === this.client.config.get('DISCORD_GUILD_ID') ? requiredRoles : requiredRoles.map(role => role.name)}`}
				`);
			} else if (INPUT === 'owner') {
				helpEmbed.setDescription(stripIndents`
					**Required ID:**
					<@${this.client.ownerID}>
				`);
			} else {
				helpEmbed.setDescription(stripIndents`
					**Required Roles:**
					none
				`);
			}

			helpEmbed.addField('\u200b', '```Commands```');

			categoryCommands.forEach((command) => {
				const commandName = [ command.name ];
				if (command.aliases) commandName.push(command.aliases.join(' | '));
				helpEmbed.addField(`${commandName.join(' | ')}`, `${command.description ?? '\u200b'}`, true);
			});

			helpEmbed
				.padFields()
				.addField('\u200B\n\u200b', stripIndents`
					Use \`${this.client.config.get('PREFIX')}help <command name>\` to get additional information on a specific command.
					Arguments: \`[required]\` \`<optional>\`
				`)
				.setTimestamp();

			return message.reply(helpEmbed);
		}


		// single command help
		const command = commands.getByName(INPUT);

		if (!command) return message.reply(`\`${INPUT}\` is neither a valid command nor category.`);

		helpEmbed.setTitle(`**Name:** ${command.name}`);

		if (command.aliases) helpEmbed.addField('**Aliases:**', command.aliases.join(', '));

		helpEmbed.addField('**Category**:', `${upperCaseFirstChar(command.category)}`);

		const { requiredRoles } = command;

		if (requiredRoles) {
			const { lgGuild } = this.client;

			if (message.guild?.id === this.client.config.get('DISCORD_GUILD_ID')) {
				helpEmbed.addField('**Required Role:**', commaListsOr`${requiredRoles.map(roleID => lgGuild.roles.cache.get(roleID) ?? roleID)}`);
			} else {
				helpEmbed.addField('**Required Role:**', commaListsOr`${requiredRoles.map(roleID => lgGuild.roles.cache.get(roleID)?.name ?? roleID)}`);
			}
		} else if (command.category === 'owner') {
			helpEmbed.addField('**Required ID:**', `<@${this.client.ownerID}>`);
		} else {
			helpEmbed.addField('**Required Role:**', 'none');
		}

		if (command.description) helpEmbed.setDescription(`${command.description}`);
		if (command.usage) helpEmbed.addField('**Usage:**', command.usageInfo);

		const COOLDOWN = command.cooldown ?? this.client.config.getNumber('COMMAND_COOLDOWN_DEFAULT');

		helpEmbed.addField('**Cooldown:**', ms(COOLDOWN * 1_000, { long: true }));

		message.reply(helpEmbed, { reply: false });
	}
};
