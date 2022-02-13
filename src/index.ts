import process from 'node:process';
import { ActivityType, GatewayIntentBits, Options, Partials, SnowflakeUtil, Sweepers } from 'discord.js';
import { RequestMethod } from '@discordjs/rest';
import { db } from './structures/database';
import { LunarClient } from './structures/LunarClient';
import { logger, seconds } from './functions';
import type { AnyChannel, ThreadChannel } from 'discord.js';

const client = new LunarClient({
	// custom options
	db,
	fetchAllMembers: true,

	// default options
	makeCache: Options.cacheWithLimits({
		ApplicationCommandManager: 0,
		MessageManager: 200,
		// @ts-expect-error
		ChannelManager: {
			sweepInterval: 3_600, // 1h
			sweepFilter: Sweepers.filterByLifetime({
				lifetime: 14_400, // 4h
				getComparisonTimestamp(e: AnyChannel) {
					if (e.isDM()) {
						// DM -> last message
						return e.lastMessageId ? SnowflakeUtil.timestampFrom(e.lastMessageId!) : -1;
					}
					return (e as ThreadChannel).archiveTimestamp ?? -1; // threads -> archived
				},
				excludeFromSweep: (e) => !e.isDM() && !(e as ThreadChannel).archived,
			}),
		},
		GuildBanManager: 0,
		GuildInviteManager: 0,
		PresenceManager: 0,
		ReactionUserManager: {
			// cache only the bot user
			maxSize: 1,
			keepOverLimit: (e) => e.id === e.client.user!.id,
		},
		StageInstanceManager: 0,
		VoiceStateManager: 0,
	}),
	sweepers: {
		...Options.defaultSweeperSettings,
		messages: {
			interval: 600,
			filter: Sweepers.filterByLifetime({
				lifetime: 1_800, // 30 min
				getComparisonTimestamp: (e) => e.editedTimestamp ?? e.createdTimestamp,
				excludeFromSweep: (e) => e.id === e.client.config.get('TAX_MESSAGE_ID'),
			}),
		},
		users: {
			interval: 21_600, // 6h
			filter: Sweepers.filterByLifetime({
				lifetime: 1, // 0 cancles the filter
				getComparisonTimestamp: () => -1,
				excludeFromSweep: (e) =>
					e.client.guilds.cache.some((guild) => guild.members.cache.has(e.id)) || // user is part of a member
					e.client.channels.cache.some((channel) => channel.isDM() && channel.recipient.id === e.id) || // user has a DM channel
					e.discriminator === '0000', // webhook message 'author'
			}),
		},
	},
	allowedMentions: { parse: ['users'], repliedUser: true },
	partials: [
		Partials.Channel, // DM channels
		Partials.GuildMember,
		Partials.Message,
		Partials.Reaction, // reactions on uncached messages
		Partials.User,
	],
	failIfNotExists: false,
	presence: {
		activities: [
			{
				name: 'slash commands',
				type: ActivityType.Listening,
			},
		],
		status: 'online',
	},
	intents: [
		GatewayIntentBits.DirectMessages, // eval edit button
		GatewayIntentBits.Guilds, // to populate guild and channel caches
		GatewayIntentBits.GuildEmojisAndStickers, // to keep the cache updated for the chat bridge
		GatewayIntentBits.GuildMembers, // guildMemberAdd, remove
		GatewayIntentBits.GuildMessages, // chat bridge
		GatewayIntentBits.GuildMessageReactions, // forward announcements to guild chat
	],
	rest: {
		// don't await channel name and topic edits
		rejectOnRateLimit: ({ method, route, timeToReset }) =>
			method === RequestMethod.Patch && route === '/channels/:id' && timeToReset > seconds(30),
	},
});

// catch rejections
process
	.on('unhandledRejection', (error) => {
		logger.error(error, '[UNCAUGHT PROMISE REJECTION]');
	})
	.on('uncaughtException', (error) => {
		logger.fatal(error, '[UNCAUGHT EXCEPTION]');
		client.exit(-1);
	})
	.on('SIGINT', () => client.exit(0));

// connect to Discord
await client.login();
