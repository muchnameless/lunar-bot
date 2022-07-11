import { setTimeout } from 'node:timers';
import ms from 'ms';
import { GuildMemberUtil, MessageUtil } from '#utils';
import { logger } from '#logger';
import { UnicodeEmoji } from '#constants';
import { assertNever, asyncFilter, commaListOr, getLilyWeight, stringToMS } from '#functions';
import { hypixel, mojang } from '#api';
import {
	demoteSuccess,
	IGN_DEFAULT,
	kickSuccess,
	INVISIBLE_CHARACTERS,
	HypixelMessageType,
	muteSuccess,
	promoteSuccess,
	unmuteSuccess,
} from '../constants';
import { ChatBridgeEvent } from '../ChatBridgeEvent';
import type { SkyBlockProfile, WeightData } from '#functions';
import type { HypixelMessage, HypixelUserMessage } from '../HypixelMessage';
import type MathsCommand from '../../../commands/general/maths';

export default class MessageChatBridgeEvent extends ChatBridgeEvent {
	/**
	 * parse server message content
	 * @param hypixelMessage
	 */
	private async _handleServerMessage(hypixelMessage: HypixelMessage) {
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
				const { sender, blockedContent } = blockedMatched.groups!;
				const senderDiscordId = this.client.players.findByIgn(sender!)?.discordId;

				// react to latest message from 'sender' with that content
				for (const { channel } of this.chatBridge.discord.channels.values()) {
					void MessageUtil.react(
						(
							await asyncFilter(
								[...(channel?.messages.cache.values() ?? [])],
								senderDiscordId
									? async (message) =>
											message.author.id === senderDiscordId &&
											(await this.chatBridge.minecraft.parseContent(message.content, message)).includes(blockedContent!)
									: async (message) =>
											(
												await this.chatBridge.minecraft.parseContent(message.content, message)
											).includes(blockedContent!),
							)
						).sort(({ createdTimestamp: a }, { createdTimestamp: b }) => b - a)[0] ?? null,
						UnicodeEmoji.Stop,
					);
				}
			}

			// DM owner to add the blocked content to the filter
			void this.client.dmOwner(`${this.chatBridge.logInfo}: blocked message: ${hypixelMessage.rawContent}`);

			return logger.error(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: blocked message: ${hypixelMessage.rawContent}`);
		}

		/**
		 * update HypixelGuild data, forward message to discord and broadcast '/gc welcome'
		 *
		 * [HYPIXEL_RANK] IGN joined the guild!
		 */
		if (hypixelMessage.content.includes('joined the guild')) {
			void this.chatBridge.hypixelGuild?.updateData();
			void hypixelMessage.forwardToDiscord();
			return void this.chatBridge.broadcast('welcome');
		}

		/**
		 * update HypixelGuild data, forward message to discord and unlink the bridge
		 *
		 * You left the guild
		 * You were kicked from the guild by [HYPIXEL_RANK] IGN for reason 'REASON'.
		 * [HYPIXEL_RANK] IGN disbanded the guild.
		 */
		if (
			hypixelMessage.content === 'You left the guild' ||
			hypixelMessage.content.startsWith('You were kicked from the guild by') ||
			hypixelMessage.content.includes('disbanded the guild')
		) {
			logger.warn(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: no more guild`);
			void this.chatBridge.hypixelGuild?.updateData();
			await hypixelMessage.forwardToDiscord();
			return void this.chatBridge.unlink();
		}

		/**
		 * update HypixelGuild data and forward message to discord
		 *
		 * [HYPIXEL_RANK] IGN left the guild!
		 * [HYPIXEL_RANK] IGN transferred Guild Master rank to [HYPIXEL_RANK] IGN
		 * [HYPIXEL_RANK] IGN renamed the guild to NEW_NAME!
		 * [HYPIXEL_RANK] IGN was kicked from the guild by [HYPIXEL_RANK] IGN!
		 */
		if (
			hypixelMessage.content.includes('left the guild') ||
			hypixelMessage.content.includes('transferred Guild Master rank to') ||
			hypixelMessage.content.includes('renamed the guild to') ||
			kickSuccess.test(hypixelMessage.content)
		) {
			void this.chatBridge.hypixelGuild?.updateData();
			return void hypixelMessage.forwardToDiscord();
		}

		/**
		 * forward message to discord
		 *
		 * [HYPIXEL_RANK] IGN set the guild tag to [TAG]! You may have to change lobbies for it to update.
		 * The guild has completed Tier 3 of this week's Guild Quest!
		 * The Guild has reached Level 36!
		 * The Guild has unlocked Winners III!
		 * GUILD QUEST TIER 1 COMPLETED!
		 */
		if (
			hypixelMessage.content === 'LEVEL UP!' ||
			hypixelMessage.content.includes('set the guild tag to') ||
			/^the guild has (?:completed|reached|unlocked)|^guild quest tier \d+ completed!?$/i.test(hypixelMessage.content)
		) {
			return void hypixelMessage.forwardToDiscord();
		}

		/**
		 * mute
		 * [HYPIXEL_RANK] IGN has muted [HYPIXEL_RANK] IGN for 10s
		 * [HYPIXEL_RANK] IGN has muted the guild chat for 10M
		 */
		const muteMatched = hypixelMessage.content.match(muteSuccess);

		if (muteMatched) {
			void hypixelMessage.forwardToDiscord();

			const { target, duration, executor } = muteMatched.groups!;

			if (target === 'the guild chat') {
				const msDuration = stringToMS(duration!);

				this.chatBridge
					.hypixelGuild!.update({
						mutedTill: Number.isNaN(msDuration) ? Number.POSITIVE_INFINITY : Date.now() + msDuration,
					})
					.catch((error) => logger.error(error));

				return logger.info(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: guild chat was muted for ${duration}`);
			}

			const player = this.client.players.findByIgn(target!);

			if (!player) return;

			const MS_DURATION = stringToMS(duration!);

			// update db and timeout discord member
			void this.chatBridge.hypixelGuild!.syncMute(
				player,
				Number.isNaN(MS_DURATION) ? Number.POSITIVE_INFINITY : Date.now() + MS_DURATION,
			);
			void (async () => {
				if (Number.isNaN(MS_DURATION)) return;
				const discordMember = await player.fetchDiscordMember();
				if (!discordMember) return;
				return void GuildMemberUtil.timeout(
					discordMember,
					MS_DURATION,
					`${executor}: \`/guild mute ${target} ${duration}\``,
				);
			})();

			return logger.info(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: ${target} was muted for ${duration}`);
		}

		/**
		 * unmute
		 * [HYPIXEL_RANK] IGN has unmuted [HYPIXEL_RANK] IGN
		 * [HYPIXEL_RANK] IGN has unmuted the guild chat!
		 */
		const unmuteMatched = hypixelMessage.content.match(unmuteSuccess);

		if (unmuteMatched) {
			void hypixelMessage.forwardToDiscord();

			const { target, executor } = unmuteMatched.groups!;

			if (target === 'the guild chat') {
				this.chatBridge.hypixelGuild!.update({ mutedTill: 0 }).catch((error) => logger.error(error));

				return logger.info(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: guild chat was unmuted`);
			}

			const player = this.client.players.findByIgn(target!);

			if (!player) return;

			// update db and remove timeout from discord member
			void this.chatBridge.hypixelGuild!.syncMute(player, null);
			void (async () => {
				const discordMember = await player.fetchDiscordMember();
				if (!discordMember) return;
				return void GuildMemberUtil.timeout(discordMember, null, `${executor}: \`/guild unmute ${target}\``);
			})();

			return logger.info(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: ${target} was unmuted`);
		}

		/**
		 * auto '/gc gg' for promotions
		 * [HYPIXEL_RANK] IGN was promoted from PREV to NOW
		 */
		const promoteMatched = hypixelMessage.content.match(promoteSuccess);

		if (promoteMatched) {
			void hypixelMessage.forwardToDiscord();

			const { target, newRank } = promoteMatched.groups!;
			const player = this.client.players.findByIgn(target!);

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
		 * [HYPIXEL_RANK] IGN was demoted from PREV to NOW
		 */
		const demotedMatched = hypixelMessage.content.match(demoteSuccess);

		if (demotedMatched) {
			void hypixelMessage.forwardToDiscord();

			const { target, newRank } = demotedMatched.groups!;
			const player = this.client.players.findByIgn(target!);

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
		 * accept g join requests if hypixel guild has it enabled and player is not on the ban list
		 * [HYPIXEL_RANK] IGN has requested to join the Guild!
		 */
		const guildJoinReqMatched = hypixelMessage.content.match(
			/(?:\[.+?\] )?(?<ign>\w+) has requested to join the Guild!/,
		);

		if (guildJoinReqMatched) {
			const { ign } = guildJoinReqMatched.groups!;

			if (!hypixelMessage.hypixelGuild?.acceptJoinRequests) {
				return logger.info(
					{ ign, status: 'ignored', reason: 'auto accepts disabled' },
					`[CHATBRIDGE]: ${this.chatBridge.logInfo}: guild join request`,
				);
			}

			try {
				const { uuid } = await mojang.ign(ign!);

				// ban list check
				const existingBan = await this.client.db.models.HypixelGuildBan.findByPk(uuid);

				if (existingBan) {
					return logger.info(
						{ ign, status: 'banned', reason: existingBan.reason },
						`[CHATBRIDGE]: ${this.chatBridge.logInfo}: guild join request`,
					);
				}

				// weight req check
				if (hypixelMessage.hypixelGuild.weightReq !== null) {
					const profiles = (await hypixel.skyblock.profiles.uuid(uuid)) as SkyBlockProfile[];

					if (!profiles?.length) {
						return logger.info(
							{ ign, status: 'ignored', reason: 'no SkyBlock profiles' },
							`[CHATBRIDGE]: ${this.chatBridge.logInfo}: guild join request`,
						);
					}

					const [{ totalWeight }] = profiles
						.map(({ members }) => getLilyWeight(members[uuid]!))
						.sort(({ totalWeight: a }, { totalWeight: b }) => b - a) as [WeightData];

					if (totalWeight < hypixelMessage.hypixelGuild.weightReq) {
						return logger.info(
							{
								ign,
								status: 'ignored',
								reason: "doesn't meet requirements",
								totalWeight,
								requiredWeight: hypixelMessage.hypixelGuild.weightReq,
							},
							`[CHATBRIDGE]: ${this.chatBridge.logInfo}: guild join request`,
						);
					}
				}

				// accept invite
				await hypixelMessage.chatBridge.minecraft.command(`/guild accept ${ign}`);
				logger.info(
					{ ign, status: 'accepted', reason: 'meets requirements' },
					`[CHATBRIDGE]: ${this.chatBridge.logInfo}: guild join request`,
				);
			} catch (error) {
				logger.info(
					{ err: error, ign, status: 'errored' },
					`[CHATBRIDGE]: ${this.chatBridge.logInfo}: guild join request`,
				);
			}

			return;
		}

		/**
		 * You joined GUILD_NAME!
		 */
		const guildJoinMatched = hypixelMessage.content.match(/(?<=^You joined ).+(?=!)/);

		if (guildJoinMatched) {
			const [guildName] = guildJoinMatched;

			void this.client.hypixelGuilds.findByName(guildName!)?.updateData();

			logger.info(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: joined ${guildName}`);
			return void this.chatBridge.link(guildName);
		}

		/**
		 * accept f reqs from guild members
		 * Friend request from [HYPIXEL_RANK] IGN
		 */
		const friendReqMatched = hypixelMessage.content.match(/Friend request from (?:\[.+?\] )?(?<ign>\w+)/);

		if (friendReqMatched) {
			const { ign } = friendReqMatched.groups!;
			const player = this.client.players.findByIgn(ign!);

			if (!player?.guildId) {
				return logger.info(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: denying f request from ${ign}`);
			}

			logger.info(`[CHATBRIDGE]: ${this.chatBridge.logInfo}: accepting f request from ${ign}`);
			return void this.chatBridge.minecraft.sendToChat(`/friend add ${ign}`);
		}
	}

	/**
	 * update player activity, execute triggers / command
	 * @param hypixelMessage
	 */
	private async _handleUserMessage(hypixelMessage: HypixelUserMessage) {
		const { player } = hypixelMessage;

		// player activity
		void player?.update({ lastActivityAt: new Date() });

		// must use prefix for commands in guild
		if (!hypixelMessage.commandData.prefix) {
			// auto maths, ignore 0-0, 4/5 (dungeon parties)
			if (
				this.config.get('CHATBRIDGE_AUTO_MATH') &&
				/^[\d ()*+./:^x-]+$/.test(hypixelMessage.content) &&
				/[1-9]/.test(hypixelMessage.content) &&
				!/^[0-5] *\/ *5$/.test(hypixelMessage.content)
			) {
				try {
					const { input, output, formattedOutput } = (this.client.commands.get('maths') as MathsCommand).calculate(
						hypixelMessage.content.replaceAll(' ', ''),
					);

					// filter out stuff like +8 = 8, 1 7 = 17
					if (!Number.isNaN(output) && output !== Number(hypixelMessage.content.replaceAll(' ', ''))) {
						void hypixelMessage.reply(`${input} = ${formattedOutput}`);
					}
				} catch (error) {
					logger.error(error);
				}
			}

			if (this.config.get('CHATBRIDGE_CHATTRIGGERS_ENABLED')) {
				for (const trigger of this.client.chatTriggers.cache.values()) {
					void trigger.testMessage(hypixelMessage);
				}
			}

			if (hypixelMessage.type !== HypixelMessageType.Whisper) return; // no prefix and no whisper
		}

		const { command } = hypixelMessage.commandData;

		// no command
		if (!command) {
			return logger.info({
				author: hypixelMessage.author.ign,
				content: hypixelMessage.content,
				channel: hypixelMessage.type,
				status: 'invalid command',
			});
		}

		// server only command in DMs
		if (command.guildOnly && hypixelMessage.type !== HypixelMessageType.Guild) {
			logger.info({
				author: hypixelMessage.author.ign,
				content: hypixelMessage.content,
				channel: hypixelMessage.type,
				status: 'guild-chat-only command in whispers',
			});
			return void hypixelMessage.author.send(`the '${command.name}' command can only be executed in guild chat`);
		}

		// message author not the bot owner
		if (player?.discordId !== this.client.ownerId) {
			// role permissions
			const requiredRoles = command.requiredRoles(hypixelMessage.hypixelGuild ?? player?.hypixelGuild);

			if (requiredRoles !== null) {
				const { member } = hypixelMessage;

				if (!member) {
					const discordGuild = hypixelMessage.hypixelGuild?.discordGuild;
					logger.info({
						author: hypixelMessage.author.ign,
						content: hypixelMessage.content,
						channel: hypixelMessage.type,
						status: `unable to find linked discord member in ${discordGuild?.name ?? 'currently unavailable'}`,
					});
					return void hypixelMessage.author.send(
						`the '${command.name}' command requires a role (${commaListOr(
							requiredRoles.map((roleId) => discordGuild?.roles.cache.get(roleId)?.name ?? roleId),
						)}) from the ${discordGuild?.name ?? '(currently unavailable)'} Discord server which you can not be found in
						`,
					);
				}

				// check for req roles
				if (!member.roles.cache.hasAny(...requiredRoles)) {
					logger.info({
						author: hypixelMessage.author.ign,
						member: member.user.tag,
						content: hypixelMessage.content,
						channel: hypixelMessage.type,
						requiredRoles,
						status: 'missing required role',
					});
					return void hypixelMessage.author.send(
						`the '${command.name}' command requires you to have a role (${commaListOr(
							requiredRoles.map((roleId) => member.guild.roles.cache.get(roleId)?.name ?? roleId),
						)}) from the ${member.guild.name} Discord Server
						`,
					);
				}
			}

			// prevent from executing owner only command
			if (command.category === 'owner') {
				return logger.info({
					author: hypixelMessage.author.ign,
					content: hypixelMessage.content,
					channel: hypixelMessage.type,
					status: 'owner only command',
				});
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

						logger.info({
							author: hypixelMessage.author.ign,
							content: hypixelMessage.content,
							channel: hypixelMessage.type,
							status: `on cooldown for ${TIME_LEFT}`,
						});

						return void hypixelMessage.author.send(`\`${command.name}\` is on cooldown for another \`${TIME_LEFT}\``);
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

			logger.info({
				author: hypixelMessage.author.ign,
				content: hypixelMessage.content,
				channel: hypixelMessage.type,
				status: 'missing mandatory arguments',
			});

			return void hypixelMessage.author.send(reply.join('\n'));
		}

		// execute command
		try {
			logger.info({
				author: hypixelMessage.author.ign,
				content: hypixelMessage.content,
				channel: hypixelMessage.type,
				command: command.name,
			});

			await command.minecraftRun(hypixelMessage);
		} catch (error) {
			logger.error({
				err: error,
				author: hypixelMessage.author.ign,
				content: hypixelMessage.content,
				channel: hypixelMessage.type,
			});

			void hypixelMessage.author.send(
				typeof error === 'string' ? error : `an error occured while executing the '${command.name}' command:\n${error}`,
			);
		}
	}

	/**
	 * event listener callback
	 * @param hypixelMessage
	 */
	override run(hypixelMessage: HypixelMessage) {
		// check if the message is a response for ChatBridge#_chat
		this.chatBridge.minecraft.collect(hypixelMessage);

		logger.trace(`[${hypixelMessage.position} #${this.chatBridge.mcAccount}]: ${hypixelMessage.cleanedContent}`);

		if (!hypixelMessage.rawContent.length) return;

		if (!hypixelMessage.isUserMessage()) {
			if (!hypixelMessage.me) return this._handleServerMessage(hypixelMessage);
			return;
		}

		switch (hypixelMessage.type) {
			case HypixelMessageType.Guild:
			case HypixelMessageType.Officer: {
				if (!this.chatBridge.isEnabled()) return;

				void hypixelMessage.forwardToDiscord();

				return this._handleUserMessage(hypixelMessage);
			}

			case HypixelMessageType.Party:
			case HypixelMessageType.Whisper: {
				if (!this.chatBridge.isEnabled()) return;

				// ignore messages from non guild players
				if (hypixelMessage.author.player?.guildId !== this.chatBridge.hypixelGuild.guildId) {
					return logger.info(`[MESSAGE]: ignored message from '${hypixelMessage.author}': ${hypixelMessage.content}`);
				}

				return this._handleUserMessage(hypixelMessage);
			}

			default:
				return assertNever(hypixelMessage.type);
		}
	}
}
