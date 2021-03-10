'use strict';

const { commaListsOr } = require('common-tags');
const { Collection } = require('discord.js');
const ms = require('ms');
const { FORWARD_TO_GC } = require('../constants/emojiCharacters');
const { escapeRegex } = require('./util');
const logger = require('../functions/logger');


/**
 * command handler
 * @param {import('../structures/extensions/Message')} message
 */
module.exports = async (message) => {
	try {
		if (message.partial) await message.fetch();
	} catch (error) {
		return logger.error('[CMD HANDLER]: error while fetching partial message:\n', error);
	}

	if (!message.content?.length) return; // ignore empty messages (attachments, embeds)

	const { client } = message;

	/**
	 * channel specific triggers
	 */

	client.hypixelGuilds.checkIfChatBridgeMessage(message);

	if (message.channel.id === client.config.get('GUILD_ANNOUNCEMENTS_CHANNEL_ID')) message.reactSafely(FORWARD_TO_GC);

	/**
	 * commands
	 */

	if (!message.isUserMessage) return; // filter out bot, system & webhook messages

	const prefixMatched = new RegExp(`^(?:${[ escapeRegex(client.config.get('PREFIX')), `<@!?${client.user.id}>` ].join('|')})`, 'i').exec(message.content); // PREFIX, @mention, no prefix

	client.hypixelGuilds.checkIfRankRequestMessage(message);

	// must use prefix for commands in guild
	if (message.guild && !prefixMatched) return;

	// command, args, flags
	const rawArgs = message.content // command arguments
		.slice(prefixMatched?.[0].length ?? 0)
		.trim()
		.split(/ +/);
	const COMMAND_NAME = rawArgs.shift().toLowerCase(); // extract first word
	const args = [];
	const flags = [];

	rawArgs.forEach(arg => (arg.startsWith('-') && arg.length > 1
		? flags.push(arg.toLowerCase().replace(/^-+/, ''))
		: args.push(arg)),
	);

	// no command, only ping or prefix
	if (!COMMAND_NAME.length) {
		logger.info(`[CMD HANDLER]: ${message.author.tag}${message.guild ? ` | ${message.member.displayName}` : ''} tried to execute '${message.content}' in ${message.guild ? `#${message.channel.name} | ${message.guild}` : 'DMs'} which is not a valid command`);
		return client.commands.help(message, args, flags).catch(logger.error);
	}

	if (client.config.getArray('REPLY_CONFIRMATION').includes(COMMAND_NAME)) return;

	const command = client.commands.getByName(COMMAND_NAME);

	// wrong command
	if (!command) return logger.info(`[CMD HANDLER]: ${message.author.tag}${message.guild ? ` | ${message.member.displayName}` : ''} tried to execute '${message.content}' in ${message.guild ? `#${message.channel.name} | ${message.guild}` : 'DMs'} which is not a valid command`);

	// 'commandName -h' -> 'h commandName'
	if (flags.some(flag => [ 'h', 'help' ].includes(flag))) {
		logger.info(`[CMD HANDLER]: '${message.content}' was executed by ${message.author.tag}${message.guild ? ` | ${message.member.displayName}` : ''} in ${message.guild ? `#${message.channel.name} | ${message.guild}` : 'DMs'}`);
		return client.commands.help(message, [ command?.name ?? COMMAND_NAME ], []).catch(logger.error);
	}

	// server only command in DMs
	if (command.guildOnly && !message.guild) {
		logger.info(`[CMD HANDLER]: ${message.author.tag} tried to execute '${message.content}' in DMs which is a server-only command`);
		return message.reply(`the \`${command.name}\` command can only be executed on servers.`);
	}

	// message author not a bot owner
	if (message.author.id !== client.ownerID) {
		// role permissions
		const { requiredRoles } = command;

		if (requiredRoles) {
			const { lgGuild } = client;

			if (!lgGuild) {
				logger.info(`[CMD HANDLER]: ${message.author.tag}${message.guild ? ` | ${message.member.displayName}` : ''} tried to execute '${message.content}' in ${message.guild ? `#${message.channel.name} | ${message.guild}` : 'DMs'} with the Lunar Guard Discord server being unreachable`);
				return message.reply(commaListsOr`the \`${command.name}\` command requires a role (${requiredRoles}) from the Lunar Guard Discord server which is unreachable at the moment.`);
			}

			/**
			 * @type {?import('../structures/extensions/GuildMember')}
			 */
			const member = message.member ?? await lgGuild.members.fetch(message.author.id).catch(error => logger.error(`[CMD HANDLER]: error while fetching member to test for permissions: ${error.name}: ${error.message}`));

			if (!member) {
				logger.info(`[CMD HANDLER]: ${message.author.tag}${message.guild ? ` | ${message.member.displayName}` : ''} tried to execute '${message.content}' in ${message.guild ? `#${message.channel.name} | ${message.guild}` : 'DMs'} and could not be found within the Lunar Guard Discord Server`);
				return message.reply(commaListsOr`the \`${command.name}\` command requires a role (${requiredRoles.map(roleID => lgGuild.roles.cache.get(roleID)?.name ?? roleID)}) from the ${lgGuild.name} Discord server which you can not be found in.`);
			}

			// check for req roles
			if (!member.roles.cache.some((_, roleID) => requiredRoles.includes(roleID))) {
				logger.info(`[CMD HANDLER]: ${message.author.tag} | ${member.displayName} tried to execute '${message.content}' in ${message.guild ? `#${message.channel.name} | ${message.guild}` : 'DMs'} without a required role`);
				return message.reply(commaListsOr`the \`${command.name}\` command requires you to have a role (${requiredRoles.map(roleID => lgGuild.roles.cache.get(roleID)?.name ?? roleID)})${message.guild?.id === lgGuild.id ? '' : 'from the Lunar Guard Discord Server'}.`);
			}

			// guild role is always a req for higher commands
			if (!member.roles.cache.has(client.config.get('GUILD_ROLE_ID'))) {
				logger.info(`[CMD HANDLER]: ${message.author.tag} | ${member.displayName} tried to execute '${message.content}' in ${message.guild ? `#${message.channel.name} | ${message.guild}` : 'DMs'} without being in the guild`);
				return message.reply(`the \`${command.name}\` command requires you to have the ${lgGuild.roles.cache.get(client.config.get('GUILD_ROLE_ID'))?.name ?? client.config.get('GUILD_ROLE_ID')} role ${message.guild?.id === lgGuild.id ? '' : 'from the Lunar Guard Discord Server'}.`);
			}

		// prevent from executing owner only command
		} else if (command.category === 'owner') {
			logger.info(`[CMD HANDLER]: ${message.author.tag}${message.guild ? ` | ${message.member.displayName}` : ''} tried to execute '${message.content}' in ${message.guild ? `#${message.channel.name} | ${message.guild}` : 'DMs'} which is an owner only command`);
			return message.reply(`the \`${command.name}\` command is only for the bot owners.`);
		}

		// command cooldowns
		if (command.cooldown) {
			if	(!client.commands.cooldowns.has(command.name)) client.commands.cooldowns.set(command.name, new Collection());

			const NOW = Date.now();
			const timestamps = client.commands.cooldowns.get(command.name);
			const COOLDOWN_TIME = (command.cooldown ?? client.config.getNumber('COMMAND_COOLDOWN_DEFAULT')) * 1000;

			if (timestamps.has(message.author.id)) {
				const expirationTime = timestamps.get(message.author.id) + COOLDOWN_TIME;

				if (NOW < expirationTime) {
					const timeLeft = ms(expirationTime - NOW, { long: true });

					logger.info(`[CMD HANDLER]: ${message.author.tag}${message.guild ? ` | ${message.member.displayName}` : ''} tried to execute '${message.content}' in ${message.guild ? `#${message.channel.name} | ${message.guild}` : 'DMs'} ${timeLeft} before the cooldown expires`);
					return message.reply(`\`${command.name}\` is on cooldown for another \`${timeLeft}\`.`);
				}
			}

			timestamps.set(message.author.id, NOW);
			setTimeout(() => timestamps.delete(message.author.id), COOLDOWN_TIME);
		}
	}

	// argument handling
	if (command.args && !args.length) {
		const reply = [];

		reply.push(`the \`${command.name}\` command has mandatory arguments.`);
		if (command.usage) reply.push(`\nUse: ${command.usageInfo}`);

		logger.info(`[CMD HANDLER]: ${message.author.tag}${message.guild ? ` | ${message.member.displayName}` : ''} tried to execute '${message.content}' in ${message.guild ? `#${message.channel.name} | ${message.guild}` : 'DMs'} without providing the mandatory arguments`);
		return message.reply(reply);
	}

	// execute command
	try {
		logger.info(`[CMD HANDLER]: '${message.content}' was executed by ${message.author.tag}${message.guild ? ` | ${message.member.displayName}` : ''} in ${message.guild ? `#${message.channel.name} | ${message.guild}` : 'DMs'}`);
		await command.run(message, args, flags, rawArgs);
	} catch (error) {
		logger.error(`[CMD HANDLER]: An error occured while ${message.author.tag}${message.guild ? ` | ${message.member.displayName}` : ''} tried to execute ${message.content} in ${message.guild ? `#${message.channel.name} | ${message.guild}` : 'DMs'}:`, error);
		message.reply(`an error occured while executing the \`${command.name}\` command:\n${error.name}: ${error.message}`);
	}
};
