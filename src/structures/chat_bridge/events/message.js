import { commaListsOr } from 'common-tags';
import ms from 'ms';
import { IGN_DEFAULT, demoteSuccess, kickSuccess, muteSuccess, promoteSuccess, unmuteSuccess } from '../constants/commandResponses.js';
import { messageTypes, invisibleCharacters } from '../constants/chatBridge.js';
import { STOP } from '../../../constants/emojiCharacters.js';
import { stringToMS } from '../../../functions/util.js';
import { MessageUtil } from '../../../util/MessageUtil.js';
import { ChatBridgeEvent } from '../ChatBridgeEvent.js';
import { logger } from '../../../functions/logger.js';


export default class MessageChatBridgeEvent extends ChatBridgeEvent {
	constructor(data) {
		super(data, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * @param {import('../HypixelMessage').HypixelMessage} hypixelMessage
	 */
	async #handleServerMessage(hypixelMessage) {
		/**
		 * You cannot say the same message twice!
		 * You can only send a message once every half second!
		 */
		if (hypixelMessage.spam) {
			return logger.error(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: anti spam failed: ${hypixelMessage.rawContent}`);
		}

		/**
		 * We blocked your comment "aFate: its because i said the sex word" as it is breaking our rules because it contains inappropriate content with adult themes. http://www.hypixel.net/rules/
		 */
		if (hypixelMessage.content.startsWith('We blocked your comment ')) {
			// react to latest message from 'sender' with that content
			const blockedMatched = hypixelMessage.rawContent.match(new RegExp(`^We blocked your comment "(?:(?<sender>${IGN_DEFAULT}): )?(?<blockedContent>.+) [${invisibleCharacters.join('')}]*" as it is breaking our rules because it`, 'su'));

			if (blockedMatched) {
				const { groups: { sender, blockedContent } } = blockedMatched;
				const senderDiscordId = this.client.players.findByIgn(sender)?.discordId;

				// react to latest message from 'sender' with that content
				for (const { channel } of this.chatBridge.discord.channels.values()) {
					MessageUtil.react(
						channel?.messages.cache
							.filter(({ content, author: { id } }) => (senderDiscordId ? id === senderDiscordId : true) && this.chatBridge.minecraft.parseContent(content).includes(blockedContent))
							.sort(({ createdTimestamp: createdTimestampA }, { createdTimestamp: createdTimestampB }) => createdTimestampB - createdTimestampA)
							.first(),
						STOP,
					);
				}
			}

			// DM owner to add the blocked content to the filter
			try {
				await this.client.dmOwner(`${this.chatBridge.logInfo}: blocked message: ${hypixelMessage.rawContent}`);
			} catch (error) {
				logger.error(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: error DMing owner blocked message`);
			}

			return logger.error(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: blocked message: ${hypixelMessage.rawContent}`);
		}

		/**
		 * auto '/gc welcome'
		 * [HypixelRank] IGN joined the guild!
		 */
		if (hypixelMessage.content.includes('joined the guild')) {
			this.chatBridge.hypixelGuild?.updatePlayers().catch(error => logger.error('[CHATBRIDGE]: guild update', error));
			hypixelMessage.forwardToDiscord();
			return this.chatBridge.broadcast('welcome');
		}

		/**
		 * [HypixelRank] IGN left the guild!
		 */
		if (hypixelMessage.content.includes('left the guild!')) {
			this.chatBridge.hypixelGuild?.updatePlayers().catch(error => logger.error('[CHATBRIDGE]: guild update', error));
			return hypixelMessage.forwardToDiscord();
		}

		/**
		 * You left the guild
		 */
		if (hypixelMessage.content === 'You left the guild') {
			logger.warn(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: bot left the guild`);
			this.chatBridge.hypixelGuild?.updatePlayers().catch(error => logger.error('[CHATBRIDGE]: guild update', error));
			hypixelMessage.forwardToDiscord();
			return this.chatBridge.unlink();
		}

		/**
		 * [HypixelRank] IGN was kicked from the guild by [HypixelRank] IGN!
		 */
		if (kickSuccess.test(hypixelMessage.content)) {
			this.chatBridge.hypixelGuild?.updatePlayers().catch(error => logger.error('[CHATBRIDGE]: guild update', error));
			return hypixelMessage.forwardToDiscord();
		}

		/**
		 * You were kicked from the guild by [HypixelRank] IGN for reason 'REASON'.
		 */
		if (hypixelMessage.content.startsWith('You were kicked from the guild by')) {
			logger.warn(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: bot was kicked from the guild`);
			this.chatBridge.hypixelGuild?.updatePlayers().catch(error => logger.error('[CHATBRIDGE]: guild update', error));
			hypixelMessage.forwardToDiscord();
			return this.chatBridge.unlink();
		}

		/**
		 * auto '/gc gg' for quest completions
		 * The guild has completed Tier 3 of this week's Guild Quest!
		 * The Guild has reached Level 36!
		 * The Guild has unlocked Winners III!
		 */
		if (hypixelMessage.content === 'LEVEL UP!' || /^the guild has (?:completed|reached|unlocked)/i.test(hypixelMessage.content)) {
			return hypixelMessage.forwardToDiscord();
		}

		/**
		 * mute
		 * [HypixelRank] IGN has muted [HypixelRank] IGN for 10s
		 * [HypixelRank] IGN has muted the guild chat for 10M
		 */
		const muteMatched = hypixelMessage.content.match(muteSuccess);

		if (muteMatched) {
			hypixelMessage.forwardToDiscord();

			const { groups: { target, duration } } = muteMatched;

			if (target === 'the guild chat') {
				const { hypixelGuild } = this.chatBridge;
				const msDuration = stringToMS(duration);

				hypixelGuild.mutedTill = Number.isNaN(msDuration)
					? Infinity
					: Date.now() + msDuration;
				hypixelGuild.save().catch(logger.error);

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
		const unmuteMatched = hypixelMessage.content.match(unmuteSuccess);

		if (unmuteMatched) {
			hypixelMessage.forwardToDiscord();

			const { groups: { target } } = unmuteMatched;

			if (target === 'the guild chat') {
				const { hypixelGuild } = this.chatBridge;

				hypixelGuild.mutedTill = 0;
				hypixelGuild.save().catch(logger.error);

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
		const promoteMatched = hypixelMessage.content.match(promoteSuccess);

		if (promoteMatched) {
			hypixelMessage.forwardToDiscord();

			const { groups: { target, newRank } } = promoteMatched;
			const player = this.client.players.findByIgn(target);

			if (!player?.guildId) return logger.info(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: '${target}' was promoted to '${newRank}' but not in the db`);

			const GUILD_RANK_PRIO = (this.chatBridge.hypixelGuild ?? player.hypixelGuild)?.ranks.find(({ name }) => name === newRank)?.priority;

			if (!GUILD_RANK_PRIO) return logger.info(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: '${target}' was promoted to an unknown rank '${newRank}'`);

			player.guildRankPriority = GUILD_RANK_PRIO;
			player.save().catch(logger.error);

			return logger.info(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: '${target}' was promoted to '${newRank}'`);
		}

		/**
		 * demote
		 * [HypixelRank] IGN was demoted from PREV to NOW
		 */
		const demotedMatched = hypixelMessage.content.match(demoteSuccess);

		if (demotedMatched) {
			hypixelMessage.forwardToDiscord();

			const { groups: { target, newRank } } = demotedMatched;
			const player = this.client.players.findByIgn(target);

			if (!player?.guildId) return logger.info(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: '${target}' was demoted to '${newRank}' but not in the db`);

			const GUILD_RANK_PRIO = (this.chatBridge.hypixelGuild ?? player.hypixelGuild)?.ranks.find(({ name }) => name === newRank)?.priority;

			if (!GUILD_RANK_PRIO) return logger.info(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: '${target}' was demoted to an unknown rank '${newRank}'`);

			player.guildRankPriority = GUILD_RANK_PRIO;
			player.save().catch(logger.error);

			return logger.info(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: '${target}' was demoted to '${newRank}'`);
		}

		/**
		 * You joined GUILD_NAME!
		 */
		const guildJoinMatched = hypixelMessage.content.match(/(?<=^You joined ).+(?=!)/);

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
		const friendReqMatched = hypixelMessage.content.match(/Friend request from (?:\[.+?\] )?(\w+)/);

		if (friendReqMatched) {
			const [ , IGN ] = friendReqMatched;
			const player = this.client.players.findByIgn(IGN);

			if (!player?.guildId) return logger.info(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: denying f request from ${IGN}`);

			logger.info(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: accepting f request from ${IGN}`);
			return this.chatBridge.minecraft.sendToChat(`/f add ${IGN}`);
		}
	}

	/**
	 * @param {import('../HypixelMessage').HypixelMessage} hypixelMessage
	 */
	async #handleCommandMessage(hypixelMessage) {
		// must use prefix for commands in guild
		if (!hypixelMessage.commandData.prefix) {
			// auto math, ignore 0-0, 4/5 (dungeon parties)
			if (this.config.get('CHATBRIDGE_AUTO_MATH') && /^[\d.+*x\-/^ ()]+$/.test(hypixelMessage.content) && /[1-9]/.test(hypixelMessage.content) && !/\b[1-5] *\/ *5\b/.test(hypixelMessage.content)) {
				try {
					const { input, output, formattedOutput, warning } = this.client.commands.get('maths').calculate(hypixelMessage.content.replaceAll(' ', ''));

					// filter out stuff like +8 = 8, 1 7 = 17
					if (output !== Number(hypixelMessage.content.replaceAll(' ', '')) && !warning) hypixelMessage.reply(`${input} = ${formattedOutput}`);
				} catch (error) {
					logger.error(error);
				}
			}

			if (this.config.get('CHATBRIDGE_CHATTRIGGERS_ENABLED')) {
				for (const /** @type {import('../../database/models/ChatTrigger')} */ trigger of this.client.chatTriggers.cache.values()) {
					trigger.testMessage(hypixelMessage);
				}
			}

			if (hypixelMessage.type !== messageTypes.WHISPER) return; // no prefix and no whisper
		}

		// no command, only ping or prefix
		if (!hypixelMessage.commandData.name) {
			logger.info(`${hypixelMessage.author} tried to execute '${hypixelMessage.content}' in '${hypixelMessage.type}' which is not a valid command`);

			if (!this.config.get('PREFIXES').slice(1)
				.includes(hypixelMessage.commandData.prefix)
			) {
				this.client.chatBridges.commands.help(hypixelMessage, hypixelMessage.commandData.args);
			}

			return;
		}

		const { command } = hypixelMessage.commandData;

		// wrong command
		if (!command) return logger.info(`${hypixelMessage.author} tried to execute '${hypixelMessage.content}' in '${hypixelMessage.type}' which is not a valid command`);

		// server only command in DMs
		if (command.guildOnly && hypixelMessage.type !== messageTypes.GUILD) {
			logger.info(`${hypixelMessage.author.tag} tried to execute '${hypixelMessage.content}' in whispers which is a guild-chat-only command`);
			return hypixelMessage.author.send(`the '${command.name}' command can only be executed in guild chat`);
		}

		const { player } = hypixelMessage;

		// message author not a bot owner
		if (player?.discordId !== this.client.ownerId) {
			// role permissions
			const { requiredRoles } = command;

			if (requiredRoles) {
				const { member } = hypixelMessage;

				if (!member) {
					const { lgGuild } = this.client;
					logger.info(`${hypixelMessage.author} tried to execute '${hypixelMessage.content}' in '${hypixelMessage.type}' and could not be found within the Lunar Guard Discord Server`);
					return hypixelMessage.author.send(commaListsOr`the '${command.name}' command requires a role (${requiredRoles.map(roleId => lgGuild.roles.cache.get(roleId)?.name ?? roleId)}) from the ${lgGuild.name} Discord server which you can not be found in`);
				}

				// check for req roles
				if (!member.roles.cache.hasAny(...requiredRoles)) {
					logger.info(`${hypixelMessage.author.tag} | ${member.displayName} tried to execute '${hypixelMessage.content}' in '${hypixelMessage.type}' without a required role`);
					return hypixelMessage.author.send(commaListsOr`the '${command.name}' command requires you to have a role (${requiredRoles.map(roleId => member.guild.roles.cache.get(roleId)?.name ?? roleId)}) from the Lunar Guard Discord Server`);
				}

			// prevent from executing owner only command
			} else if (command.category === 'owner') {
				return logger.info(`${hypixelMessage.author} tried to execute '${hypixelMessage.content}' in '${hypixelMessage.type}' which is an owner only command`);
			}

			// command cooldowns
			if (command.cooldown !== 0) {
				const NOW = Date.now();
				const COOLDOWN_TIME = (command.cooldown ?? this.config.get('COMMAND_COOLDOWN_DEFAULT')) * 1_000;
				const IDENTIFIER = hypixelMessage.member?.id ?? hypixelMessage.author.ign;

				if (command.timestamps.has(IDENTIFIER)) {
					const EXPIRATION_TIME = command.timestamps.get(IDENTIFIER) + COOLDOWN_TIME;

					if (NOW < EXPIRATION_TIME) {
						const TIME_LEFT = ms(EXPIRATION_TIME - NOW, { long: true });

						logger.info(`${hypixelMessage.author}${hypixelMessage.member ? ` | ${hypixelMessage.member.displayName}` : ''} tried to execute '${hypixelMessage.content}' in ${hypixelMessage.type}-chat ${TIME_LEFT} before the cooldown expires`);

						return hypixelMessage.author.send(`\`${command.name}\` is on cooldown for another \`${TIME_LEFT}\``);
					}
				}

				command.timestamps.set(IDENTIFIER, NOW);
				setTimeout(() => command.timestamps.delete(IDENTIFIER), COOLDOWN_TIME);
			}
		}

		// argument handling
		if (typeof command.args === 'boolean'
			? (command.args && !hypixelMessage.commandData.args.length)
			: (hypixelMessage.commandData.args.length < command.args)
		) {
			const reply = [];

			reply.push(`the '${command.name}' command has${typeof command.args === 'number' ? ` ${command.args}` : ''} mandatory argument${command.args === 1 ? '' : 's'}`);
			if (command.usage) reply.push(`use: ${command.usageInfo}`);

			logger.info(`${hypixelMessage.author} tried to execute '${hypixelMessage.content}' in '${hypixelMessage.type}' without providing the mandatory arguments`);
			return hypixelMessage.author.send(reply.join('\n'));
		}

		// execute command
		try {
			logger.info(`'${hypixelMessage.content}' was executed by ${hypixelMessage.author} in '${hypixelMessage.type}'`);
			await command.runInGame(hypixelMessage);
		} catch (error) {
			logger.error(`An error occured while ${hypixelMessage.author} tried to execute ${hypixelMessage.content} in '${hypixelMessage.type}'`, error);
			hypixelMessage.author.send(`an error occured while executing the '${command.name}' command:\n${error}`);
		}
	}

	/**
	 * event listener callback
	 * @param {import('../HypixelMessage').HypixelMessage} hypixelMessage
	 */
	async run(hypixelMessage) {
		// check if the message is a response for ChatBridge#_chat
		this.chatBridge.minecraft.collect(hypixelMessage);

		if (this.config.get('CHAT_LOGGING_ENABLED')) logger.debug(`[${hypixelMessage.position} #${this.chatBridge.mcAccount}]: ${hypixelMessage.cleanedContent}`);
		if (!hypixelMessage.rawContent.length) return;

		switch (hypixelMessage.type) {
			case messageTypes.GUILD:
			case messageTypes.OFFICER: {
				if (!this.chatBridge.enabled || hypixelMessage.me) return;

				hypixelMessage.forwardToDiscord();

				return this.#handleCommandMessage(hypixelMessage);
			}

			case messageTypes.PARTY:
			case messageTypes.WHISPER: {
				if (!this.chatBridge.enabled || hypixelMessage.me) return;
				if (hypixelMessage.author.player?.guildId !== this.chatBridge.hypixelGuild.guildId) return logger.info(`[MESSAGE]: ignored message from '${hypixelMessage.author}': ${hypixelMessage.content}`); // ignore messages from non guild players

				return this.#handleCommandMessage(hypixelMessage);
			}

			default:
				return this.#handleServerMessage(hypixelMessage);
		}
	}
}
