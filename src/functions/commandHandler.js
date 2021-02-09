'use strict';

const { commaListsOr } = require('common-tags');
const { Collection } = require('discord.js');
const ms = require('ms');
const { escapeRegex, autocorrect } = require('./util');
const logger = require('../functions/logger');


// command handler
module.exports = async (client, message) => {
	try {
		if (message.partial) await message.fetch();
	} catch (error) {
		return logger.error('error while fetching partial message:\n', error);
	}

	if (message.author.bot || message.system || message.webhookID || !message.content) return; // filter out bot, system & webhook messages

	const { config } = client;
	const [ MATCHED_PREFIX ] = new RegExp(`^(?:${[ escapeRegex(config.get('PREFIX')), `<@!?${client.user.id}>`, '' ].join('|')})`, 'i').exec(message.content); // PREFIX, @mention, no prefix

	if (message.guild && !MATCHED_PREFIX.length) { // must use prefix for commands in guild
		// channel-specific triggers
		return client.hypixelGuilds.find(hGuild => hGuild.rankRequestChannelID === message.channel.id)?.handleRankRequest(message);
	}

	// banned users
	if (client.bannedUsers.has(message.author.id)) {
		const bannedUser = client.bannedUsers.get(message.author.id);
		const { reason, expiresAt } = bannedUser;

		if (Date.now() >= expiresAt) {
			client.bannedUsers.remove(message.author.id).then(logger.info);
		} else {
			logger.info(`${message.author.tag}${message.guild ? ` | ${message.member.displayName}` : ''} tried to execute '${message.content}' in ${message.guild ? `#${message.channel.name} | ${message.guild}` : 'DMs'} while being on the banned users list for ${reason}`);
			return message.author.send(`you are currently banned from using ${client.user} ${bannedUser.expiresAt === Infinity ? 'indefinitely' : `for ${ms(bannedUser.expiresAt - Date.now(), { long: true })}`}. Reason: ${reason?.length ? reason : 'no reason specified'}`).catch(logger.error);
		}
	}

	// command, args, flags
	const rawArgs = message.content.slice(MATCHED_PREFIX.length).trim().split(/ +/); // command arguments
	const COMMAND_NAME = rawArgs.shift().toLowerCase(); // extract first word
	const args = [];
	const flags = [];

	rawArgs.forEach(arg => arg.startsWith('-') && arg.length > 1
		? flags.push(arg.toLowerCase().replace(/^-+/, ''))
		: args.push(arg),
	);

	// no command, only ping or prefix
	if (!COMMAND_NAME.length) {
		logger.info(`${message.author.tag}${message.guild ? ` | ${message.member.displayName}` : ''} tried to execute '${message.content}' in ${message.guild ? `#${message.channel.name} | ${message.guild}` : 'DMs'} which is not a valid command`);
		return client.commands.help(message, args, flags).catch(logger.error);
	}

	if (config.getArray('REPLY_CONFIRMATION').includes(COMMAND_NAME)) return;

	let command = client.commands.getByName(COMMAND_NAME);

	// wrong command
	if (!command) {
		// dont autocorrect 1 char command names
		if (COMMAND_NAME.length === 1) return logger.info(`${message.author.tag}${message.guild ? ` | ${message.member.displayName}` : ''} tried to execute '${message.content}' in ${message.guild ? `#${message.channel.name} | ${message.guild}` : 'DMs'} which is not a valid command`);

		// autocorrect for user commands that are atleast 2 chars long
		const result = autocorrect(COMMAND_NAME, client.commands.filter(c => c.category === 'user').map(c => c.aliases?.length ? [ c.name, ...c.aliases ] : c.name).flat().filter(name => name.length > 1));

		if (result.similarity >= config.get('AUTOCORRECT_THRESHOLD')) command = client.commands.getByName(result.value);
	}

	// 'commandName -h' -> 'h commandName'
	if (flags.some(flag => [ 'h', 'help' ].includes(flag))) {
		logger.info(`'${message.content}' was executed by ${message.author.tag}${message.guild ? ` | ${message.member.displayName}` : ''} in ${message.guild ? `#${message.channel.name} | ${message.guild}` : 'DMs'}`);
		return client.commands.help(client, config, message, [ command?.name ?? COMMAND_NAME ], []).catch(logger.error);
	}

	if (!command) return;

	// server only command in DMs
	if (command.guildOnly && !message.guild) {
		logger.info(`${message.author.tag} tried to execute '${message.content}' in DMs which is a server-only command`);
		return message.reply('this command can only be executed on servers.');
	}

	// message author not a bot owner
	if (message.author.id !== client.ownerID) {

		// role permissions
		const requiredRoles = command.requiredRoles;

		if (requiredRoles) {
			const lgGuild = client.lgGuild;

			if (!lgGuild) {
				logger.info(`${message.author.tag}${message.guild ? ` | ${message.member.displayName}` : ''} tried to execute '${message.content}' in ${message.guild ? `#${message.channel.name} | ${message.guild}` : 'DMs'} with the Lunar Guard Discord Server being unreachable`);
				return message.reply('this command requires a role from the Lunar Guard Discord Server which is unreachable at the moment.');
			}

			const member = await lgGuild.members.fetch(message.author.id).catch(error => logger.error(`error while fetching member to test for permissions: ${error.name}: ${error.message}`));

			if (!member) {
				logger.info(`${message.author.tag}${message.guild ? ` | ${message.member.displayName}` : ''} tried to execute '${message.content}' in ${message.guild ? `#${message.channel.name} | ${message.guild}` : 'DMs'} and could not be found within the Lunar Guard Discord Server`);
				return message.reply(`this command requires a role from the ${lgGuild.name} Discord Server which you can not be found in.`);
			}

			// check for req roles
			if (!member.roles.cache.some(role => requiredRoles.includes(role.id))) {
				logger.info(`${message.author.tag} | ${member.displayName} tried to execute '${message.content}' in ${message.guild ? `#${message.channel.name} | ${message.guild}` : 'DMs'} without a required role`);
				return message.reply(commaListsOr`you are missing role permissions ${message.guild?.id === lgGuild.id ? '' : 'from the Lunar Guard Discord Server '}(${requiredRoles.map(roleID => lgGuild.roles.cache.get(roleID)?.name ?? roleID)}) to execute this command.`);
			}

			// guild role is always a req for higher commands
			if (!member.roles.cache.has(config.get('GUILD_ROLE_ID'))) {
				logger.info(`${message.author.tag} | ${member.displayName} tried to execute '${message.content}' in ${message.guild ? `#${message.channel.name} | ${message.guild}` : 'DMs'} without being in the guild`);
				return message.reply(`you need the ${lgGuild.roles.cache.get(config.get('GUILD_ROLE_ID'))?.name ?? config.get('GUILD_ROLE_ID')} role ${message.guild?.id === lgGuild.id ? '' : 'from the Lunar Guard Discord Server '}to execute this command.`);
			}

		// prevent from executing owner only command
		} else if (command.category === 'owner') {
			logger.info(`${message.author.tag}${message.guild ? ` | ${message.member.displayName}` : ''} tried to execute '${message.content}' in ${message.guild ? `#${message.channel.name} | ${message.guild}` : 'DMs'} which is an owner only command`);
			return message.reply('this command is only for the bot owners.');
		}

		// command cooldowns
		if	(!client.cooldowns.has(command.name)) client.cooldowns.set(command.name, new Collection());

		const NOW = Date.now();
		const timestamps = client.cooldowns.get(command.name);
		const COOLDOWN_TIME = (command.cooldown ?? config.getNumber('COMMAND_COOLDOWN_DEFAULT')) * 1000;

		if (timestamps.has(message.author.id)) {
			const expirationTime = timestamps.get(message.author.id) + COOLDOWN_TIME;

			if (NOW < expirationTime) {
				const timeLeft = ms(expirationTime - NOW, { long: true });

				logger.info(`${message.author.tag}${message.guild ? ` | ${message.member.displayName}` : ''} tried to execute '${message.content}' in ${message.guild ? `#${message.channel.name} | ${message.guild}` : 'DMs'} ${timeLeft} before the cooldown expires`);
				return message.reply(`\`${command.name}\` is on cooldown for another \`${timeLeft}\`.`);
			}
		}

		timestamps.set(message.author.id, NOW);
		setTimeout(() => timestamps.delete(message.author.id), COOLDOWN_TIME);
	}

	// argument handling
	if (command.args && !args.length) {
		const reply = [];

		reply.push('this command has mandatory arguments.');
		if (command.usage) reply.push(`\nUse: \`${config.get('PREFIX')}${command.aliases?.[0] ?? command.name}\` ${command.usage}`);

		logger.info(`${message.author.tag}${message.guild ? ` | ${message.member.displayName}` : ''} tried to execute '${message.content}' in ${message.guild ? `#${message.channel.name} | ${message.guild}` : 'DMs'} without providing the mandatory arguments`);
		return message.reply(reply);
	}

	// execute command
	try {
		logger.info(`'${message.content}' was executed by ${message.author.tag}${message.guild ? ` | ${message.member.displayName}` : ''} in ${message.guild ? `#${message.channel.name} | ${message.guild}` : 'DMs'}`);
		await command.run(client, config, message, args, flags, rawArgs);
	} catch (error) {
		logger.error(`An error occured while ${message.author.tag}${message.guild ? ` | ${message.member.displayName}` : ''} tried to execute ${message.content} in ${message.guild ? `#${message.channel.name} | ${message.guild}` : 'DMs'}:`, error);
		message.reply(`an error occured while executing this command:\n${error.name}: ${error.message}`);
	}
};
