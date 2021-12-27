import process from 'node:process';
import { Intents, SnowflakeUtil, Options, Sweepers, Constants } from 'discord.js';
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
					if (e.type === 'DM') {
						// DM -> last message
						return e.lastMessageId ? SnowflakeUtil.timestampFrom(e.lastMessageId!) : -1;
					}
					return (e as ThreadChannel).archiveTimestamp ?? -1; // threads -> archived
				},
				excludeFromSweep: (e) => e.type !== 'DM' && !(e as ThreadChannel).archived,
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
				excludeFromSweep: (e) => e.id === (e.client as LunarClient).config.get('TAX_MESSAGE_ID'),
			}),
		},
		users: {
			interval: 21_600, // 6h
			filter: Sweepers.filterByLifetime({
				lifetime: 1, // 0 cancles the filter
				getComparisonTimestamp: () => -1,
				excludeFromSweep: (e) =>
					e.client.guilds.cache.some((guild) => guild.members.cache.has(e.id)) || // user is part of a member
					e.client.channels.cache.some((channel) => channel.type === 'DM' && channel.recipient.id === e.id) || // user has a DM channel
					e.discriminator === '0000', // webhook message 'author'
			}),
		},
	},
	allowedMentions: { parse: ['users'], repliedUser: true },
	partials: [
		Constants.PartialTypes.CHANNEL, // DM channels
		Constants.PartialTypes.GUILD_MEMBER,
		Constants.PartialTypes.MESSAGE,
		Constants.PartialTypes.REACTION, // reactions on uncached messages
		Constants.PartialTypes.USER,
	],
	restGlobalRateLimit: 50,
	// don't await channel name and topic edits
	rejectOnRateLimit: ({ route, method, timeout }) =>
		route.startsWith('/channels') && !route.includes('/messages') && method === 'patch' && timeout > seconds(10),
	failIfNotExists: false,
	presence: {
		activities: [
			{
				name: 'slash commands',
				type: Constants.ActivityTypes.LISTENING,
			},
		],
		status: 'online',
	},
	intents: [
		Intents.FLAGS.DIRECT_MESSAGES, // eval edit button
		// Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
		// Intents.FLAGS.DIRECT_MESSAGE_TYPING,
		Intents.FLAGS.GUILDS, // to populate guild and channel caches
		// Intents.FLAGS.GUILD_BANS,
		Intents.FLAGS.GUILD_EMOJIS_AND_STICKERS, // to keep the cache updated for the chat bridge
		// Intents.FLAGS.GUILD_INTEGRATIONS,
		// Intents.FLAGS.GUILD_INVITES,
		Intents.FLAGS.GUILD_MEMBERS, // guildMemberAdd, remove
		Intents.FLAGS.GUILD_MESSAGES, // chat bridge
		Intents.FLAGS.GUILD_MESSAGE_REACTIONS, // forward announcements to guild chat
		// Intents.FLAGS.GUILD_MESSAGE_TYPING,
		// Intents.FLAGS.GUILD_PRESENCES,
		// Intents.FLAGS.GUILD_VOICE_STATES,
		// Intents.FLAGS.GUILD_WEBHOOKS,
	],
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
