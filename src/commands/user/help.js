'use strict';

const { MessageEmbed, version } = require('discord.js');
const { commaListsOr, stripIndents } = require('common-tags');
const ms = require('ms');
const { upperCaseFirstChar, getRequiredRoles } = require('../../functions/util');


module.exports = {
	aliases: [ 'h' ],
	description: 'list of all commands or info about a specific command',
	usage: '<`command`|`category` name>',
	cooldown: 1,
	execute: async (message, args, flags) => {
		const { client } = message;
		const { commands, config } = client;
		const helpEmbed = new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'));


		// default help
		if (!args.length) {
			const BOT_ID = client.user.id;
			const invisibleCategories = [ 'hidden', 'owner' ];
			const categories = [ ...new Set(commands.map(command => command.category)) ].filter(category => !invisibleCategories.includes(category));

			for (const category of categories) {
				helpEmbed.addField(
					`${upperCaseFirstChar(category)} commands`,
					` • ${commands
						.filter(command => command.category === category)
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
					Use \`${config.get('PREFIX')}\` or <@!${BOT_ID}> as prefix in servers.
					\u200b
				`)
				.padFields()
				.addField('\u200b', stripIndents`
					Use \`${config.get('PREFIX')}help <command/category name>\` to get additional information on a specific command/category.
					Arguments: \`[required]\` \`<optional>\`
					
					Feel free to tag me <@${client.ownerID}> with or DM me any bugs or feature requests.
				`)
				.setFooter(`Hosted on a Raspberry Pi 4 B • Discord.js ${version}`)
				.setTimestamp();

			return message.reply(helpEmbed);
		}


		// category help
		const categories = [ ...new Set(commands.map(command => command.category)) ];

		if (categories.includes(args[0].toLowerCase())) {
			const CATEGORY_NAME = args[0].toLowerCase();
			const categoryCommands = commands.filter(command => command.category === CATEGORY_NAME);

			helpEmbed
				.setTitle(`Category: ${upperCaseFirstChar(CATEGORY_NAME)}`);

			let requiredRoles = getRequiredRoles(CATEGORY_NAME, config);

			if (requiredRoles) {
				requiredRoles = requiredRoles.map(roleID => client.lgGuild?.roles.cache.get(roleID));
				helpEmbed.setDescription(stripIndents`
					**Required Role:**
					${commaListsOr`${message.guild?.id === config.get('DISCORD_GUILD_ID') ? requiredRoles : requiredRoles.map(role => role.name)}`}
				`);
			} else if (CATEGORY_NAME === 'owner') {
				helpEmbed.setDescription(stripIndents`
					**Required ID:**
					<@${client.ownerID}>
				`);
			} else {
				helpEmbed.setDescription(stripIndents`
					**Required Role:**
					none
				`);
			}

			helpEmbed.addField('\u200b', '```Commands```');

			categoryCommands.forEach(command => {
				const commandName = [ command.name ];
				if (command.aliases) commandName.push(command.aliases.join(' | '));
				helpEmbed.addField(`${commandName.join(' | ')}`, `${command.description || '\u200b'}`, true);
			});

			helpEmbed
				.padFields()
				.addField('\u200B\n\u200b', stripIndents`
					Use \`${config.get('PREFIX')}help <command name>\` to get additional information on a specific command.
					Arguments: \`[required]\` \`<optional>\`
				`)
				.setTimestamp();

			return message.reply(helpEmbed);
		}


		// single command help
		const COMMAND_NAME = args[0].toLowerCase();
		const command = commands.getByName(COMMAND_NAME);

		if (!command) return message.reply(`\`${COMMAND_NAME}\` is neither a valid command nor category.`);

		helpEmbed.setTitle(`**Name:** ${command.name}`);

		if (command.aliases) helpEmbed.addField('**Aliases:**', command.aliases.join(', '));

		helpEmbed.addField('**Category**:', `${upperCaseFirstChar(command.category)}`);

		const requiredRoles = getRequiredRoles(command.category, config);

		if (requiredRoles) {
			const lgGuild = client.lgGuild;
			if (message.guild?.id === config.get('DISCORD_GUILD_ID')) {
				helpEmbed.addField('**Required Role:**', commaListsOr`${requiredRoles.map(roleID => lgGuild.roles.cache.get(roleID) ?? roleID)}`);
			} else {
				helpEmbed.addField('**Required Role:**', commaListsOr`${requiredRoles.map(roleID => lgGuild.roles.cache.get(roleID)?.name ?? roleID)}`);
			}
		} else if (command.category === 'owner') {
			helpEmbed.addField('**Required ID:**', `<@${client.ownerID}>`);
		} else {
			helpEmbed.addField('**Required Role:**', 'none');
		}

		if (command.description) helpEmbed.setDescription(`${command.description}`);
		if (command.usage) {
			if (typeof command.usage === 'function') {
				helpEmbed.addField('**Usage:**', `\`${config.get('PREFIX')}${command.aliases?.[0] ?? command.name}\` ${command.usage(client)}`);
			} else { // string
				helpEmbed.addField('**Usage:**', `\`${config.get('PREFIX')}${command.aliases?.[0] ?? command.name}\` ${command.usage}`);
			}
		}

		const COOLDOWN = command.cooldown ?? config.getNumber('COMMAND_COOLDOWN_DEFAULT');

		helpEmbed.addField('**Cooldown:**', ms(COOLDOWN * 1000, { long: true }));

		message.reply(helpEmbed, { reply: false });
	},
};
