'use strict';

const { Collection } = require('discord.js');
const { commaListsOr } = require('common-tags');
const ms = require('ms');
const { escapeRegex } = require('../../functions/util');
const { messageTypes: { GUILD } } = require('../../constants/chatBridge');
const logger = require('../../functions/logger');


/**
 * command handler for the chatBridge
 * @param {import('./ChatBridge')} chatBridge
 * @param {import('./HypixelMessage')} message
 */
module.exports = async (chatBridge, message) => {
	if (!message.author || !message.content.length) return;

	const { client } = chatBridge;
	const { config } = client;
	const prefixMatched = new RegExp(`^(?:${[ escapeRegex(config.get('PREFIX')), escapeRegex(config.get('INGAME_PREFIX')), `@${chatBridge.bot.username}` ].join('|')})`, 'i').exec(message.content); // PREFIX, INGAME_PREFIX, @mention

	// must use prefix for commands in guild
	if (message.type === GUILD && !prefixMatched) return;

	// command, args, flags
	const rawArgs = message.content.slice(prefixMatched?.[0].length ?? 0).trim().split(/ +/); // command arguments
	const COMMAND_NAME = rawArgs.shift().toLowerCase(); // extract first word
	const args = [];
	const flags = [];

	rawArgs.forEach(arg => arg.startsWith('-') && arg.length > 1
		? flags.push(arg.toLowerCase().replace(/^-+/, ''))
		: args.push(arg),
	);

	// no command, only ping or prefix
	if (!COMMAND_NAME.length) {
		logger.info(`${message.author.ign} tried to execute '${message.content}' in '${message.type}' which is not a valid command`);
		return client.chatBridges.commands.help(client, config, message, args, flags).catch(logger.error);
	}

	const command = client.chatBridges.commands.getByName(COMMAND_NAME);

	// wrong command
	if (!command) return logger.info(`${message.author.ign} tried to execute '${message.content}' in '${message.type}' which is not a valid command`);

	// 'commandName -h' -> 'h commandName'
	if (flags.some(flag => [ 'h', 'help' ].includes(flag))) {
		logger.info(`'${message.content}' was executed by ${message.author.ign} in '${message.type}'`);
		return client.chatBridges.commands.help(client, config, message, [ command?.name ?? COMMAND_NAME ], []).catch(logger.error);
	}

	// server only command in DMs
	if (command.guildOnly && message.type !== GUILD) {
		logger.info(`${message.author.tag} tried to execute '${message.content}' in whispers which is a guild-chat-only command`);
		return message.reply(`the '${command.name}' command can only be executed in guild chat`);
	}

	const player = message.player;

	// message author not a bot owner
	if (player?.discordID !== client.ownerID) {

		// role permissions
		const requiredRoles = command.requiredRoles;

		if (requiredRoles) {
			const lgGuild = client.lgGuild;

			if (!lgGuild) {
				logger.info(`${message.author.ign} tried to execute '${message.content}' in '${message.type}' with the Lunar Guard Discord server being unreachable`);
				return message.reply(commaListsOr`the '${command.name}' command requires a role (${requiredRoles}) from the Lunar Guard Discord server which is unreachable at the moment`);
			}

			const member = await player?.discordMember;

			if (!member) {
				logger.info(`${message.author.ign} tried to execute '${message.content}' in '${message.type}' and could not be found within the Lunar Guard Discord Server`);
				return message.reply(commaListsOr`the '${command.name}' command requires a role (${requiredRoles.map(roleID => lgGuild.roles.cache.get(roleID)?.name ?? roleID)}) from the ${lgGuild.name} Discord server which you can not be found in`);
			}

			// check for req roles
			if (!member.roles.cache.some((_, roleID) => requiredRoles.includes(roleID))) {
				logger.info(`${message.author.tag} | ${member.displayName} tried to execute '${message.content}' in '${message.type}' without a required role`);
				return message.reply(commaListsOr`the '${command.name}' command requires you to have a role (${requiredRoles.map(roleID => lgGuild.roles.cache.get(roleID)?.name ?? roleID)}) from the Lunar Guard Discord Server`);
			}

			// guild role is always a req for higher commands
			if (!member.roles.cache.has(config.get('GUILD_ROLE_ID'))) {
				logger.info(`${message.author.tag} | ${member.displayName} tried to execute '${message.content}' in '${message.type}' without being in the guild`);
				return message.reply(`the '${command.name}' command requires you to have the ${lgGuild.roles.cache.get(config.get('GUILD_ROLE_ID'))?.name ?? config.get('GUILD_ROLE_ID')} role from the Lunar Guard Discord Server`);
			}

		// prevent from executing owner only command
		} else if (command.category === 'owner') {
			logger.info(`${message.author.ign} tried to execute '${message.content}' in '${message.type}' which is an owner only command`);
			return message.reply(`the '${command.name}' command is only for the bot owners`);
		}

		// command cooldowns
		if (command.cooldown) {
			if	(!client.commands.cooldowns.has(command.name)) client.commands.cooldowns.set(command.name, new Collection());

			const NOW = Date.now();
			const timestamps = client.commands.cooldowns.get(command.name);
			const COOLDOWN_TIME = (command.cooldown ?? config.getNumber('COMMAND_COOLDOWN_DEFAULT')) * 1000;

			if (timestamps.has(message.author.ign)) {
				const expirationTime = timestamps.get(message.author.ign) + COOLDOWN_TIME;

				if (NOW < expirationTime) {
					const timeLeft = ms(expirationTime - NOW, { long: true });

					logger.info(`${message.author.tag}${message.guild ? ` | ${message.member.displayName}` : ''} tried to execute '${message.content}' in ${message.guild ? `#${message.channel.name} | ${message.guild}` : 'DMs'} ${timeLeft} before the cooldown expires`);
					return message.reply(`'${command.name}' is on cooldown for another ${timeLeft}`);
				}
			}

			timestamps.set(message.author.ign, NOW);
			setTimeout(() => timestamps.delete(message.author.ign), COOLDOWN_TIME);
		}
	}

	// argument handling
	if (command.args && !args.length) {
		const reply = [];

		reply.push(`the '${command.name}' command has mandatory arguments`);
		if (command.usage) reply.push(`\nUse: ${command.usageInfo}`);

		logger.info(`${message.author.ign} tried to execute '${message.content}' in '${message.type}' without providing the mandatory arguments`);
		return message.reply(reply.join('; \n'));
	}

	// execute command
	try {
		logger.info(`'${message.content}' was executed by ${message.author.ign} in '${message.type}'`);
		await command.run(client, config, message, args, flags, rawArgs);
	} catch (error) {
		logger.error(`An error occured while ${message.author.ign} tried to execute ${message.content} in '${message.type}':`, error);
		message.reply(`an error occured while executing the '${command.name}' command:\n${error.name}: ${error.message}`);
	}
};
