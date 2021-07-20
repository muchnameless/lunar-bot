'use strict';

const { commaListsOr } = require('common-tags');
const ms = require('ms');
const { messageTypes: { GUILD, WHISPER } } = require('../constants/chatBridge');
const logger = require('../../../functions/logger');


/**
 * command handler for the chatBridge
 * @param {import('../HypixelMessage')} message
 */
module.exports = async (message) => {
	const { client } = message;

	// must use prefix for commands in guild
	if (!message.commandData.prefix) {
		// auto math, ignore 0-0, 4/5 (dungeon parties)
		if (client.config.get('CHATBRIDGE_AUTO_MATH') && /^[\d.+*x\-/^ ()]+$/.test(message.content) && /[1-9]/.test(message.content) && !/\b[1-5] *\/ *5\b/.test(message.content)) {
			try {
				const { input, output, formattedOutput, warning } = client.commands.get('maths').calculate(message.content.replaceAll(' ', ''));

				// filter out stuff like +8 = 8, 1 7 = 17
				if (output !== Number(message.content.replaceAll(' ', '')) && !warning) message.reply(`${input} = ${formattedOutput}`);
			} catch (error) {
				logger.error(error);
			}
		}

		if (client.config.get('CHATBRIDGE_CHATTRIGGERS_ENABLED')) {
			for (const /** @type {import('../../database/models/ChatTrigger')} */ trigger of client.chatTriggers.cache.values()) {
				trigger.testMessage(message);
			}
		}

		if (message.type !== WHISPER) return; // no prefix and no whisper
	}

	// no command, only ping or prefix
	if (!message.commandData.name) {
		logger.info(`${message.author.ign} tried to execute '${message.content}' in '${message.type}' which is not a valid command`);

		if (!client.config.get('PREFIXES').slice(1)
			.includes(message.commandData.prefix)
		) {
			client.chatBridges.commands.help(message, message.commandData.args);
		}

		return;
	}

	const { command } = message.commandData;

	// wrong command
	if (!command) return logger.info(`${message.author.ign} tried to execute '${message.content}' in '${message.type}' which is not a valid command`);

	// server only command in DMs
	if (command.guildOnly && message.type !== GUILD) {
		logger.info(`${message.author.tag} tried to execute '${message.content}' in whispers which is a guild-chat-only command`);
		return message.author.send(`the '${command.name}' command can only be executed in guild chat`);
	}

	const { player } = message;

	// message author not a bot owner
	if (player?.discordId !== client.ownerId) {
		// role permissions
		const { requiredRoles } = command;

		if (requiredRoles) {
			const { lgGuild } = client;

			if (!lgGuild) {
				logger.info(`${message.author.ign} tried to execute '${message.content}' in '${message.type}' with the Lunar Guard Discord server being unreachable`);
				return message.author.send(commaListsOr`the '${command.name}' command requires a role (${requiredRoles}) from the Lunar Guard Discord server which is unreachable at the moment`);
			}

			const member = await player?.discordMember;

			if (!member) {
				logger.info(`${message.author.ign} tried to execute '${message.content}' in '${message.type}' and could not be found within the Lunar Guard Discord Server`);
				return message.author.send(commaListsOr`the '${command.name}' command requires a role (${requiredRoles.map(roleId => lgGuild.roles.cache.get(roleId)?.name ?? roleId)}) from the ${lgGuild.name} Discord server which you can not be found in`);
			}

			// check for req roles
			if (!member.roles.cache.some((_, roleId) => requiredRoles.includes(roleId))) {
				logger.info(`${message.author.tag} | ${member.displayName} tried to execute '${message.content}' in '${message.type}' without a required role`);
				return message.author.send(commaListsOr`the '${command.name}' command requires you to have a role (${requiredRoles.map(roleId => lgGuild.roles.cache.get(roleId)?.name ?? roleId)}) from the Lunar Guard Discord Server`);
			}

		// prevent from executing owner only command
		} else if (command.category === 'owner') {
			return logger.info(`${message.author.ign} tried to execute '${message.content}' in '${message.type}' which is an owner only command`);
		}

		// command cooldowns
		if (command.cooldown !== 0) {
			const NOW = Date.now();
			const COOLDOWN_TIME = (command.cooldown ?? client.config.get('COMMAND_COOLDOWN_DEFAULT')) * 1000;
			const IDENTIFIER = message.member?.id ?? message.author.ign;

			if (command.timestamps.has(IDENTIFIER)) {
				const EXPIRATION_TIME = command.timestamps.get(IDENTIFIER) + COOLDOWN_TIME;

				if (NOW < EXPIRATION_TIME) {
					const TIME_LEFT = ms(EXPIRATION_TIME - NOW, { long: true });

					logger.info(`${message.author.ign}${message.member ? ` | ${message.member.displayName}` : ''} tried to execute '${message.content}' in ${message.type}-chat ${TIME_LEFT} before the cooldown expires`);

					return message.author.send(`\`${command.name}\` is on cooldown for another \`${TIME_LEFT}\``);
				}
			}

			command.timestamps.set(IDENTIFIER, NOW);
			setTimeout(() => command.timestamps.delete(IDENTIFIER), COOLDOWN_TIME);
		}
	}

	// argument handling
	if (typeof command.args === 'boolean'
		? (command.args && !message.commandData.args.length)
		: (message.commandData.args.length < command.args)
	) {
		const reply = [];

		reply.push(`the '${command.name}' command has${typeof command.args === 'number' ? ` ${command.args}` : ''} mandatory argument${command.args === 1 ? '' : 's'}`);
		if (command.usage) reply.push(`use: ${command.usageInfo}`);

		logger.info(`${message.author.ign} tried to execute '${message.content}' in '${message.type}' without providing the mandatory arguments`);
		return message.author.send(reply.join('\n'));
	}

	// execute command
	try {
		logger.info(`'${message.content}' was executed by ${message.author.ign} in '${message.type}'`);
		await command.runInGame(message);
	} catch (error) {
		logger.error(`An error occured while ${message.author.ign} tried to execute ${message.content} in '${message.type}'`, error);
		message.author.send(`an error occured while executing the '${command.name}' command:\n${error}`);
	}
};
