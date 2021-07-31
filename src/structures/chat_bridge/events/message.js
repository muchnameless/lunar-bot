'use strict';

const { commaListsOr } = require('common-tags');
const ms = require('ms');
const { defaults: { ign: IGN_REGEXP }, demoteSuccess, kickSuccess, muteSuccess, promoteSuccess, unmuteSuccess } = require('../constants/commandResponses');
const { messageTypes: { WHISPER, GUILD, OFFICER, PARTY }, invisibleCharacters } = require('../constants/chatBridge');
const { STOP } = require('../../../constants/emojiCharacters');
const { stringToMS } = require('../../../functions/util');
const ChatBridgeEvent = require('../ChatBridgeEvent');
const logger = require('../../../functions/logger');


module.exports = class MessageChatBridgeEvent extends ChatBridgeEvent {
	constructor(data) {
		super(data, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * @param {import('../HypixelMessage')} message
	 */
	async _handleServerMessage(message) {
		/**
		 * You cannot say the same message twice!
		 * You can only send a message once every half second!
		 */
		if (message.spam) {
			try {
				await this.client.dmOwner(`${this.chatBridge.logInfo}: anti spam failed: ${message.rawContent}`);
			} catch (error) {
				logger.error(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: error DMing owner 'anti spam failed'`);
			}

			return logger.error(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: anti spam failed: ${message.rawContent}`);
		}

		/**
		 * We blocked your comment "aFate: its because i said the sex word" as it is breaking our rules because it contains inappropriate content with adult themes. http://www.hypixel.net/rules/
		 */
		if (message.content.startsWith('We blocked your comment ')) {
			// react to latest message from 'sender' with that content
			const blockedMatched = message.rawContent.match(new RegExp(`^We blocked your comment "(?:(?<sender>${IGN_REGEXP}): )?(?<blockedContent>.+) [${invisibleCharacters.join('')}]*" as it is breaking our rules because it`, 'su'));

			if (blockedMatched) {
				const { groups: { sender, blockedContent } } = blockedMatched;
				const senderDiscordId = this.client.players.findByIgn(sender)?.discordId;

				// react to latest message from 'sender' with that content
				for (const { channel } of this.chatBridge.discord.channels.values()) {
					channel?.messages.cache
						.filter(({ content, author: { id } }) => (senderDiscordId ? id === senderDiscordId : true) && this.chatBridge.minecraft.parseContent(content).includes(blockedContent))
						.sort(({ createdTimestamp: createdTimestampA }, { createdTimestamp: createdTimestampB }) => createdTimestampB - createdTimestampA)
						.first()
						?.react(STOP);
				}
			}

			// DM owner to add the blocked content to the filter
			try {
				await this.client.dmOwner(`${this.chatBridge.logInfo}: blocked message: ${message.rawContent}`);
			} catch (error) {
				logger.error(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: error DMing owner blocked message`);
			}

			return logger.error(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: blocked message: ${message.rawContent}`);
		}

		/**
		 * auto '/gc welcome'
		 * [HypixelRank] IGN joined the guild!
		 */
		if (message.content.includes('joined the guild')) {
			this.chatBridge.guild?.updatePlayers().catch(error => logger.error('[CHATBRIDGE]: guild update', error));
			message.forwardToDiscord();
			return this.chatBridge.broadcast('welcome');
		}

		/**
		 * [HypixelRank] IGN left the guild!
		 */
		if (message.content.includes('left the guild!')) {
			this.chatBridge.guild?.updatePlayers().catch(error => logger.error('[CHATBRIDGE]: guild update', error));
			return message.forwardToDiscord();
		}

		/**
		 * You left the guild
		 */
		if (message.content === 'You left the guild') {
			logger.warn(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: bot left the guild`);
			this.chatBridge.guild?.updatePlayers().catch(error => logger.error('[CHATBRIDGE]: guild update', error));
			message.forwardToDiscord();
			return this.chatBridge.unlink();
		}

		/**
		 * [HypixelRank] IGN was kicked from the guild by [HypixelRank] IGN!
		 */
		if (kickSuccess.test(message.content)) {
			this.chatBridge.guild?.updatePlayers().catch(error => logger.error('[CHATBRIDGE]: guild update', error));
			return message.forwardToDiscord();
		}

		/**
		 * You were kicked from the guild by [HypixelRank] IGN for reason 'REASON'.
		 */
		if (message.content.startsWith('You were kicked from the guild by')) {
			logger.warn(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: bot was kicked from the guild`);
			this.chatBridge.guild?.updatePlayers().catch(error => logger.error('[CHATBRIDGE]: guild update', error));
			message.forwardToDiscord();
			return this.chatBridge.unlink();
		}

		/**
		 * auto '/gc gg' for quest completions
		 * The guild has completed Tier 3 of this week's Guild Quest!
		 * The Guild has reached Level 36!
		 * The Guild has unlocked Winners III!
		 */
		if (message.content === 'LEVEL UP!' || /^the guild has (?:completed|reached|unlocked)/i.test(message.content)) {
			return message.forwardToDiscord();
		}

		/**
		 * mute
		 * [HypixelRank] IGN has muted [HypixelRank] IGN for 10s
		 * [HypixelRank] IGN has muted the guild chat for 10M
		 */
		const muteMatched = message.content.match(muteSuccess);

		if (muteMatched) {
			message.forwardToDiscord();

			const { groups: { target, duration } } = muteMatched;

			if (target === 'the guild chat') {
				const { guild } = this.chatBridge;
				const msDuration = stringToMS(duration);

				guild.mutedTill = Number.isNaN(msDuration)
					? Infinity
					: Date.now() + msDuration;
				guild.save().catch(logger.error);

				return logger.info(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: guild chat was muted for ${duration}`);
			}

			const player = this.client.players.findByIgn(target);

			if (!player) return;

			const msDuration = stringToMS(duration);

			player.mutedTill = Number.isNaN(msDuration)
				? Infinity
				: Date.now() + msDuration;
			player.save().catch(logger.error);

			return logger.info(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: ${target} was muted for ${duration}`);
		}

		/**
		 * unmute
		 * [HypixelRank] IGN has unmuted [HypixelRank] IGN
		 * [HypixelRank] IGN has unmuted the guild chat!
		 */
		const unmuteMatched = message.content.match(unmuteSuccess);

		if (unmuteMatched) {
			message.forwardToDiscord();

			const { groups: { target } } = unmuteMatched;

			if (target === 'the guild chat') {
				const { guild } = this.chatBridge;

				guild.mutedTill = 0;
				guild.save().catch(logger.error);

				return logger.info(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: guild chat was unmuted`);
			}

			const player = this.client.players.findByIgn(target);

			if (!player) return;

			player.mutedTill = 0;
			player.save().catch(logger.error);

			return logger.info(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: ${target} was unmuted`);
		}

		/**
		 * auto '/gc gg' for promotions
		 * [HypixelRank] IGN was promoted from PREV to NOW
		 */
		const promoteMatched = message.content.match(promoteSuccess);

		if (promoteMatched) {
			message.forwardToDiscord();

			const { groups: { target, newRank } } = promoteMatched;
			const player = this.client.players.findByIgn(target);

			if (!player?.guildId) return logger.info(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: '${target}' was promoted to '${newRank}' but not in the db`);

			const GUILD_RANK_PRIO = (this.chatBridge.guild ?? player.guild)?.ranks.find(({ name }) => name === newRank)?.priority;

			if (!GUILD_RANK_PRIO) return logger.info(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: '${target}' was promoted to an unknown rank '${newRank}'`);

			player.guildRankPriority = GUILD_RANK_PRIO;
			player.save().catch(logger.error);

			return logger.info(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: '${target}' was promoted to '${newRank}'`);
		}

		/**
		 * demote
		 * [HypixelRank] IGN was demoted from PREV to NOW
		 */
		const demotedMatched = message.content.match(demoteSuccess);

		if (demotedMatched) {
			message.forwardToDiscord();

			const { groups: { target, newRank } } = demotedMatched;
			const player = this.client.players.findByIgn(target);

			if (!player?.guildId) return logger.info(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: '${target}' was demoted to '${newRank}' but not in the db`);

			const GUILD_RANK_PRIO = (this.chatBridge.guild ?? player.guild)?.ranks.find(({ name }) => name === newRank)?.priority;

			if (!GUILD_RANK_PRIO) return logger.info(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: '${target}' was demoted to an unknown rank '${newRank}'`);

			player.guildRankPriority = GUILD_RANK_PRIO;
			player.save().catch(logger.error);

			return logger.info(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: '${target}' was demoted to '${newRank}'`);
		}

		/**
		 * You joined GUILD_NAME!
		 */
		const guildJoinMatched = message.content.match(/(?<=^You joined ).+(?=!)/);

		if (guildJoinMatched) {
			const [ guildName ] = guildJoinMatched;

			this.client.hypixelGuilds
				.getByName(guildName)
				?.updatePlayers()
				.catch(error => logger.error('[CHATBRIDGE]: guild update', error));
			logger.info(`[CHATBRIDGE]: ${this.chatBridge.bot.username}: joined ${guildName}`);
			return this.chatBridge.link(guildName);
		}

		/**
		 * accept f reqs from guild members
		 * Friend request from [HypixelRank] IGN\n
		 */
		const friendReqMatched = message.content.match(/Friend request from (?:\[.+?\] )?(\w+)/);

		if (friendReqMatched) {
			const [ , IGN ] = friendReqMatched;
			const player = this.client.players.findByIgn(IGN);

			if (!player?.guildId) return logger.info(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: denying f request from ${IGN}`);

			logger.info(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: accepting f request from ${IGN}`);
			return this.chatBridge.minecraft.sendToChat(`/f add ${IGN}`);
		}
	}

	/**
	 * @param {import('../HypixelMessage')} message
	 */
	async _handleCommandMessage(message) {
		// must use prefix for commands in guild
		if (!message.commandData.prefix) {
			// auto math, ignore 0-0, 4/5 (dungeon parties)
			if (this.config.get('CHATBRIDGE_AUTO_MATH') && /^[\d.+*x\-/^ ()]+$/.test(message.content) && /[1-9]/.test(message.content) && !/\b[1-5] *\/ *5\b/.test(message.content)) {
				try {
					const { input, output, formattedOutput, warning } = this.client.commands.get('maths').calculate(message.content.replaceAll(' ', ''));

					// filter out stuff like +8 = 8, 1 7 = 17
					if (output !== Number(message.content.replaceAll(' ', '')) && !warning) message.reply(`${input} = ${formattedOutput}`);
				} catch (error) {
					logger.error(error);
				}
			}

			if (this.config.get('CHATBRIDGE_CHATTRIGGERS_ENABLED')) {
				for (const /** @type {import('../../database/models/ChatTrigger')} */ trigger of this.client.chatTriggers.cache.values()) {
					trigger.testMessage(message);
				}
			}

			if (message.type !== WHISPER) return; // no prefix and no whisper
		}

		// no command, only ping or prefix
		if (!message.commandData.name) {
			logger.info(`${message.author} tried to execute '${message.content}' in '${message.type}' which is not a valid command`);

			if (!this.config.get('PREFIXES').slice(1)
				.includes(message.commandData.prefix)
			) {
				this.client.chatBridges.commands.help(message, message.commandData.args);
			}

			return;
		}

		const { command } = message.commandData;

		// wrong command
		if (!command) return logger.info(`${message.author} tried to execute '${message.content}' in '${message.type}' which is not a valid command`);

		// server only command in DMs
		if (command.guildOnly && message.type !== GUILD) {
			logger.info(`${message.author.tag} tried to execute '${message.content}' in whispers which is a guild-chat-only command`);
			return message.author.send(`the '${command.name}' command can only be executed in guild chat`);
		}

		const { player } = message;

		// message author not a bot owner
		if (player?.discordId !== this.client.ownerId) {
			// role permissions
			const { requiredRoles } = command;

			if (requiredRoles) {
				const { member } = message;

				if (!member) {
					logger.info(`${message.author} tried to execute '${message.content}' in '${message.type}' and could not be found within the Lunar Guard Discord Server`);
					return message.author.send(commaListsOr`the '${command.name}' command requires a role (${requiredRoles.map(roleId => member.guild.roles.cache.get(roleId)?.name ?? roleId)}) from the ${member.guild.name} Discord server which you can not be found in`);
				}

				// check for req roles
				if (!member.roles.cache.some((_, roleId) => requiredRoles.includes(roleId))) {
					logger.info(`${message.author.tag} | ${member.displayName} tried to execute '${message.content}' in '${message.type}' without a required role`);
					return message.author.send(commaListsOr`the '${command.name}' command requires you to have a role (${requiredRoles.map(roleId => member.guild.roles.cache.get(roleId)?.name ?? roleId)}) from the Lunar Guard Discord Server`);
				}

			// prevent from executing owner only command
			} else if (command.category === 'owner') {
				return logger.info(`${message.author} tried to execute '${message.content}' in '${message.type}' which is an owner only command`);
			}

			// command cooldowns
			if (command.cooldown !== 0) {
				const NOW = Date.now();
				const COOLDOWN_TIME = (command.cooldown ?? this.config.get('COMMAND_COOLDOWN_DEFAULT')) * 1_000;
				const IDENTIFIER = message.member?.id ?? message.author.ign;

				if (command.timestamps.has(IDENTIFIER)) {
					const EXPIRATION_TIME = command.timestamps.get(IDENTIFIER) + COOLDOWN_TIME;

					if (NOW < EXPIRATION_TIME) {
						const TIME_LEFT = ms(EXPIRATION_TIME - NOW, { long: true });

						logger.info(`${message.author}${message.member ? ` | ${message.member.displayName}` : ''} tried to execute '${message.content}' in ${message.type}-chat ${TIME_LEFT} before the cooldown expires`);

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

			logger.info(`${message.author} tried to execute '${message.content}' in '${message.type}' without providing the mandatory arguments`);
			return message.author.send(reply.join('\n'));
		}

		// execute command
		try {
			logger.info(`'${message.content}' was executed by ${message.author} in '${message.type}'`);
			await command.runInGame(message);
		} catch (error) {
			logger.error(`An error occured while ${message.author} tried to execute ${message.content} in '${message.type}'`, error);
			message.author.send(`an error occured while executing the '${command.name}' command:\n${error}`);
		}
	}

	/**
	 * event listener callback
	 * @param {import('../HypixelMessage')} message
	 */
	async run(message) {
		// check if the message is a response for ChatBridge#_chat
		this.chatBridge.minecraft.collect(message);

		if (this.config.get('CHAT_LOGGING_ENABLED')) logger.debug(`[${message.position} #${this.chatBridge.mcAccount}]: ${message.cleanedContent}`);
		if (!message.rawContent.length) return;

		switch (message.type) {
			case GUILD:
			case OFFICER: {
				if (!this.chatBridge.enabled || message.me) return;

				message.forwardToDiscord();

				return this._handleCommandMessage(message);
			}

			case PARTY:
			case WHISPER: {
				if (!this.chatBridge.enabled || message.me) return;
				if (message.author.player?.guildId !== this.chatBridge.guild.guildId) return logger.info(`[MESSAGE]: ignored message from '${message.author}': ${message.content}`); // ignore messages from non guild players

				return this._handleCommandMessage(message);
			}

			default:
				return this._handleServerMessage(message);
		}
	}
};
