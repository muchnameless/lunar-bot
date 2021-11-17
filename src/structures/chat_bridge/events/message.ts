import { commaListsOr } from 'common-tags';
import ms from 'ms';
import {
	demoteSuccess,
	IGN_DEFAULT,
	kickSuccess,
	INVISIBLE_CHARACTERS,
	MESSAGE_TYPES,
	muteSuccess,
	promoteSuccess,
	unmuteSuccess,
} from '../constants';
import { STOP_EMOJI } from '../../../constants';
import { MessageUtil } from '../../../util';
import { logger, stringToMS } from '../../../functions';
import { ChatBridgeEvent } from '../ChatBridgeEvent';
import type { EventContext } from '../../events/BaseEvent';
import type { HypixelMessage, HypixelUserMessage } from '../HypixelMessage';
import type MathsCommand from '../../../commands/general/maths';

export default class MessageChatBridgeEvent extends ChatBridgeEvent {
	constructor(context: EventContext) {
		super(context, {
			once: false,
			enabled: true,
		});
	}

	/**
	 * parse server message content
	 * @param hypixelMessage
	 */
	async #handleServerMessage(hypixelMessage: HypixelMessage) {
		/**
		 * You cannot say the same message twice!
		 * You can only send a message once every half second!
		 */
		if (hypixelMessage.spam) {
			return logger.warn(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: anti spam failed: ${hypixelMessage.rawContent}`);
		}
		/**
		 * We blocked your comment "aFate: its because i said the sex word" as it is breaking our rules because it contains inappropriate content with adult themes. http://www.hypixel.net/rules/
		 */
		if (hypixelMessage.content.startsWith('We blocked your comment ')) {
			// react to latest message from 'sender' with that content
			const blockedMatched = hypixelMessage.rawContent.match(
				new RegExp(
					`^We blocked your comment "(?:(?<sender>${IGN_DEFAULT}): )?(?<blockedContent>.+) [${INVISIBLE_CHARACTERS.join(
						'',
					)}]*" as it is breaking our rules because it`,
					'su',
				),
			);

			if (blockedMatched) {
				const { sender, blockedContent } = blockedMatched.groups as { sender: string; blockedContent: string };
				const senderDiscordId = this.client.players.findByIgn(sender)?.discordId;

				// react to latest message from 'sender' with that content
				for (const { channel } of this.chatBridge.discord.channels.values()) {
					MessageUtil.react(
						channel?.messages.cache
							.filter(
								({ content, author: { id } }) =>
									(senderDiscordId ? id === senderDiscordId : true) &&
									this.chatBridge.minecraft.parseContent(content).includes(blockedContent),
							)
							.sort(({ createdTimestamp: a }, { createdTimestamp: b }) => b - a)
							.first() ?? null,
						STOP_EMOJI,
					);
				}
			}

			// DM owner to add the blocked content to the filter
			try {
				await this.client.dmOwner(`${this.chatBridge.logInfo}: blocked message: ${hypixelMessage.rawContent}`);
			} catch (error) {
				logger.error(error, `[CHATBRIDGE]: ${this.chatBridge.logInfo}: error DMing owner blocked message`);
			}

			return logger.error(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: blocked message: ${hypixelMessage.rawContent}`);
		}

		/**
		 * auto '/gc welcome'
		 * [HypixelRank] IGN joined the guild!
		 */
		if (hypixelMessage.content.includes('joined the guild')) {
			this.chatBridge.hypixelGuild?.updateData();
			hypixelMessage.forwardToDiscord();
			return this.chatBridge.broadcast('welcome');
		}

		/**
		 * [HypixelRank] IGN left the guild!
		 * [MVP++] vndb transferred Guild Master rank to [MVP+] Underappreciated
		 */
		if (
			hypixelMessage.content.includes('left the guild') ||
			hypixelMessage.content.includes('transferred Guild Master rank to')
		) {
			this.chatBridge.hypixelGuild?.updateData();
			return hypixelMessage.forwardToDiscord();
		}

		/**
		 * You left the guild
		 * [MVP+] Underappreciated disbanded the guild.
		 */
		if (hypixelMessage.content === 'You left the guild' || hypixelMessage.content.includes('disbanded the guild')) {
			logger.warn(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: no more guild`);
			this.chatBridge.hypixelGuild?.updateData();
			hypixelMessage.forwardToDiscord();
			return this.chatBridge.unlink();
		}

		/**
		 * [HypixelRank] IGN was kicked from the guild by [HypixelRank] IGN!
		 */
		if (kickSuccess.test(hypixelMessage.content)) {
			this.chatBridge.hypixelGuild?.updateData();
			return hypixelMessage.forwardToDiscord();
		}

		/**
		 * You were kicked from the guild by [HypixelRank] IGN for reason 'REASON'.
		 */
		if (hypixelMessage.content.startsWith('You were kicked from the guild by')) {
			logger.warn(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: bot was kicked from the guild`);
			this.chatBridge.hypixelGuild?.updateData();
			hypixelMessage.forwardToDiscord();
			return this.chatBridge.unlink();
		}

		/**
		 * auto '/gc gg' for quest completions
		 * The guild has completed Tier 3 of this week's Guild Quest!
		 * The Guild has reached Level 36!
		 * The Guild has unlocked Winners III!
		 * GUILD QUEST TIER 1 COMPLETED!
		 */
		if (
			hypixelMessage.content === 'LEVEL UP!' ||
			/^the guild has (?:completed|reached|unlocked)|^guild quest tier \d+ completed!?$/i.test(hypixelMessage.content)
		) {
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

			const { target, duration } = muteMatched.groups as { target: string; duration: string };

			if (target === 'the guild chat') {
				const msDuration = stringToMS(duration);

				this.chatBridge
					.hypixelGuild!.update({
						mutedTill: Number.isNaN(msDuration) ? Number.POSITIVE_INFINITY : Date.now() + msDuration,
					})
					.catch((error) => logger.error(error));

				return logger.info(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: guild chat was muted for ${duration}`);
			}

			const player = this.client.players.findByIgn(target);

			if (!player) return;

			const msDuration = stringToMS(duration);

			player
				.update({
					mutedTill: Number.isNaN(msDuration) ? Number.POSITIVE_INFINITY : Date.now() + msDuration,
				})
				.catch((error) => logger.error(error));

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

			const { target } = unmuteMatched.groups as { target: string };

			if (target === 'the guild chat') {
				this.chatBridge.hypixelGuild!.update({ mutedTill: 0 }).catch((error) => logger.error(error));

				return logger.info(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: guild chat was unmuted`);
			}

			const player = this.client.players.findByIgn(target);

			if (!player) return;

			player.update({ mutedTill: 0 }).catch((error) => logger.error(error));

			return logger.info(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: ${target} was unmuted`);
		}

		/**
		 * auto '/gc gg' for promotions
		 * [HypixelRank] IGN was promoted from PREV to NOW
		 */
		const promoteMatched = hypixelMessage.content.match(promoteSuccess);

		if (promoteMatched) {
			hypixelMessage.forwardToDiscord();

			const { target, newRank } = promoteMatched.groups as { target: string; newRank: string };
			const player = this.client.players.findByIgn(target);

			if (!player?.guildId) {
				return logger.info(
					`[CHATBRIDGE]: ${this.chatBridge.logInfo}: '${target}' was promoted to '${newRank}' but not in the db`,
				);
			}

			const GUILD_RANK_PRIO = (this.chatBridge.hypixelGuild ?? player.hypixelGuild)?.ranks.find(
				({ name }) => name === newRank,
			)?.priority;

			if (!GUILD_RANK_PRIO) {
				return logger.info(
					`[CHATBRIDGE]: ${this.chatBridge.logInfo}: '${target}' was promoted to an unknown rank '${newRank}'`,
				);
			}

			player.update({ guildRankPriority: GUILD_RANK_PRIO }).catch((error) => logger.error(error));

			return logger.info(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: '${target}' was promoted to '${newRank}'`);
		}

		/**
		 * demote
		 * [HypixelRank] IGN was demoted from PREV to NOW
		 */
		const demotedMatched = hypixelMessage.content.match(demoteSuccess);

		if (demotedMatched) {
			hypixelMessage.forwardToDiscord();

			const { target, newRank } = demotedMatched.groups as { target: string; newRank: string };
			const player = this.client.players.findByIgn(target);

			if (!player?.guildId) {
				return logger.info(
					`[CHATBRIDGE]: ${this.chatBridge.logInfo}: '${target}' was demoted to '${newRank}' but not in the db`,
				);
			}

			const GUILD_RANK_PRIO = (this.chatBridge.hypixelGuild ?? player.hypixelGuild)?.ranks.find(
				({ name }) => name === newRank,
			)?.priority;

			if (!GUILD_RANK_PRIO) {
				return logger.info(
					`[CHATBRIDGE]: ${this.chatBridge.logInfo}: '${target}' was demoted to an unknown rank '${newRank}'`,
				);
			}

			player.update({ guildRankPriority: GUILD_RANK_PRIO }).catch((error) => logger.error(error));

			return logger.info(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: '${target}' was demoted to '${newRank}'`);
		}

		/**
		 * You joined GUILD_NAME!
		 */
		const guildJoinMatched = hypixelMessage.content.match(/(?<=^You joined ).+(?=!)/);

		if (guildJoinMatched) {
			const [guildName] = guildJoinMatched;

			this.client.hypixelGuilds.getByName(guildName)?.updateData();

			logger.info(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: joined ${guildName}`);
			return this.chatBridge.link(guildName);
		}

		/**
		 * accept f reqs from guild members
		 * Friend request from [HypixelRank] IGN\n
		 */
		const friendReqMatched = hypixelMessage.content.match(/Friend request from (?:\[.+?\] )?(\w+)/);

		if (friendReqMatched) {
			const [, IGN] = friendReqMatched;
			const player = this.client.players.findByIgn(IGN);

			if (!player?.guildId) {
				return logger.info(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: denying f request from ${IGN}`);
			}

			logger.info(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: accepting f request from ${IGN}`);
			return this.chatBridge.minecraft.sendToChat(`/f add ${IGN}`);
		}
	}

	/**
	 * update player activity, execute triggers / command
	 * @param hypixelMessage
	 */
	async #handleUserMessage(hypixelMessage: HypixelUserMessage) {
		const { player } = hypixelMessage;

		// player activity
		player?.update({ lastActivityAt: new Date() });

		// must use prefix for commands in guild
		if (!hypixelMessage.commandData.prefix) {
			// auto math, ignore 0-0, 4/5 (dungeon parties)
			if (
				this.config.get('CHATBRIDGE_AUTO_MATH') &&
				/^[\d ()*+./:^x-]+$/.test(hypixelMessage.content) &&
				/[1-9]/.test(hypixelMessage.content) &&
				!/\b[1-5] *\/ *5\b/.test(hypixelMessage.content)
			) {
				try {
					const { input, output, formattedOutput } = (this.client.commands.get('maths') as MathsCommand).calculate(
						hypixelMessage.content.replaceAll(' ', ''),
					);

					// filter out stuff like +8 = 8, 1 7 = 17
					if (!Number.isNaN(output) && output !== Number(hypixelMessage.content.replaceAll(' ', ''))) {
						hypixelMessage.reply(`${input} = ${formattedOutput}`);
					}
				} catch (error) {
					logger.error(error);
				}
			}

			if (this.config.get('CHATBRIDGE_CHATTRIGGERS_ENABLED')) {
				for (const trigger of this.client.chatTriggers.cache.values()) {
					trigger.testMessage(hypixelMessage);
				}
			}

			if (hypixelMessage.type !== MESSAGE_TYPES.WHISPER) return; // no prefix and no whisper
		}

		const { command } = hypixelMessage.commandData;

		// no command
		if (!command) {
			return logger.info(
				`${hypixelMessage.author} tried to execute '${hypixelMessage.content}' in '${hypixelMessage.type}' which is not a valid command`,
			);
		}

		// server only command in DMs
		if (command.guildOnly && hypixelMessage.type !== MESSAGE_TYPES.GUILD) {
			logger.info(
				`${hypixelMessage.author.ign} tried to execute '${hypixelMessage.content}' in whispers which is a guild-chat-only command`,
			);
			return hypixelMessage.author.send(`the '${command.name}' command can only be executed in guild chat`);
		}

		// message author not a bot owner
		if (player?.discordId !== this.client.ownerId) {
			// role permissions
			const { requiredRoles } = command;

			if (requiredRoles) {
				const { member } = hypixelMessage;

				if (!member) {
					const { lgGuild } = this.client;
					logger.info(
						`${hypixelMessage.author} tried to execute '${hypixelMessage.content}' in '${hypixelMessage.type}' and could not be found within the Lunar Guard Discord Server`,
					);
					return hypixelMessage.author.send(
						commaListsOr`the '${command.name}' command requires a role (${requiredRoles.map(
							(roleId) => lgGuild?.roles.cache.get(roleId)?.name ?? roleId,
						)}) from the ${lgGuild?.name ?? '(currently unavailable)'} Discord server which you can not be found in
						`,
					);
				}

				// check for req roles
				if (!member.roles.cache.hasAny(...requiredRoles)) {
					logger.info(
						`${hypixelMessage.author.ign} | ${member.displayName} tried to execute '${hypixelMessage.content}' in '${hypixelMessage.type}' without a required role`,
					);
					return hypixelMessage.author.send(
						commaListsOr`the '${command.name}' command requires you to have a role (${requiredRoles.map(
							(roleId) => member.guild.roles.cache.get(roleId)?.name ?? roleId,
						)}) from the Lunar Guard Discord Server
						`,
					);
				}

				// prevent from executing owner only command
			} else if (command.category === 'owner') {
				return logger.info(
					`${hypixelMessage.author} tried to execute '${hypixelMessage.content}' in '${hypixelMessage.type}' which is an owner only command`,
				);
			}

			// command cooldowns
			if (command.timestamps) {
				const NOW = Date.now();
				const COOLDOWN_TIME = command.cooldown ?? this.config.get('COMMAND_COOLDOWN_DEFAULT');
				const IDENTIFIER = hypixelMessage.member?.id ?? hypixelMessage.author.ign;

				if (command.timestamps.has(IDENTIFIER)) {
					const EXPIRATION_TIME = command.timestamps.get(IDENTIFIER)! + COOLDOWN_TIME;

					if (NOW < EXPIRATION_TIME) {
						const TIME_LEFT = ms(EXPIRATION_TIME - NOW, { long: true });

						logger.info(
							`${hypixelMessage.author}${
								hypixelMessage.member ? ` | ${hypixelMessage.member.displayName}` : ''
							} tried to execute '${hypixelMessage.content}' in ${
								hypixelMessage.type
							}-chat ${TIME_LEFT} before the cooldown expires`,
						);

						return hypixelMessage.author.send(`\`${command.name}\` is on cooldown for another \`${TIME_LEFT}\``);
					}
				}

				command.timestamps.set(IDENTIFIER, NOW);
				setTimeout(() => command.timestamps!.delete(IDENTIFIER), COOLDOWN_TIME);
			}
		}

		// argument handling
		if (
			command.args &&
			(typeof command.args === 'boolean'
				? !hypixelMessage.commandData.args.length
				: hypixelMessage.commandData.args.length < command.args)
		) {
			const reply: string[] = [];

			reply.push(
				`the '${command.name}' command has${
					typeof command.args === 'number' ? ` ${command.args}` : ''
				} mandatory argument${command.args === 1 ? '' : 's'}`,
			);
			if (command.usage) reply.push(`use: ${command.usageInfo}`);

			logger.info(
				`${hypixelMessage.author} tried to execute '${hypixelMessage.content}' in '${hypixelMessage.type}' without providing the mandatory arguments`,
			);
			return hypixelMessage.author.send(reply.join('\n'));
		}

		// execute command
		try {
			logger.info(`'${hypixelMessage.content}' was executed by ${hypixelMessage.author} in '${hypixelMessage.type}'`);
			await command.runMinecraft(hypixelMessage);
		} catch (error) {
			logger.error(
				error,
				`An error occured while ${hypixelMessage.author} tried to execute ${hypixelMessage.content} in '${hypixelMessage.type}'`,
			);
			hypixelMessage.author.send(`an error occured while executing the '${command.name}' command:\n${error}`);
		}
	}

	/**
	 * event listener callback
	 * @param hypixelMessage
	 */
	override run(hypixelMessage: HypixelMessage) {
		// check if the message is a response for ChatBridge#_chat
		this.chatBridge.minecraft.collect(hypixelMessage);

		if (this.config.get('CHAT_LOGGING_ENABLED')) {
			logger.debug(`[${hypixelMessage.position} #${this.chatBridge.mcAccount}]: ${hypixelMessage.cleanedContent}`);
		}

		if (!hypixelMessage.rawContent.length) return;

		if (!hypixelMessage.isUserMessage()) {
			if (!hypixelMessage.me) return this.#handleServerMessage(hypixelMessage);
			return;
		}

		switch (hypixelMessage.type) {
			case MESSAGE_TYPES.GUILD:
			case MESSAGE_TYPES.OFFICER: {
				if (!this.chatBridge.isEnabled()) return;

				hypixelMessage.forwardToDiscord();

				return this.#handleUserMessage(hypixelMessage);
			}

			case MESSAGE_TYPES.PARTY:
			case MESSAGE_TYPES.WHISPER: {
				if (!this.chatBridge.isEnabled()) return;

				// ignore messages from non guild players
				if (hypixelMessage.author.player?.guildId !== this.chatBridge.hypixelGuild.guildId) {
					return logger.info(`[MESSAGE]: ignored message from '${hypixelMessage.author}': ${hypixelMessage.content}`);
				}

				return this.#handleUserMessage(hypixelMessage);
			}

			default: {
				const never: never = hypixelMessage.type;
				logger.error(`[MESSAGE]: unknown type '${never}'`);
			}
		}
	}
}
