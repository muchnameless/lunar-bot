import { ActivityType, GatewayIntentBits, Options, Partials, PresenceUpdateStatus, Routes, Sweepers } from 'discord.js';
import { RequestMethod } from '@discordjs/rest';
import { LunarClient } from './structures/LunarClient';
import { seconds } from './functions';
import { startJobs } from './jobs';

const client = new LunarClient({
	makeCache: Options.cacheWithLimits({
		...Options.DefaultMakeCacheSettings,
		ApplicationCommandManager: 0,
		GuildBanManager: 0,
		GuildInviteManager: 0,
		GuildScheduledEventManager: 0,
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
		...Options.DefaultSweeperSettings,
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
					e.client.channels.cache.some((channel) => channel.isDM() && channel.recipientId === e.id) || // user has a DM channel
					e.discriminator === '0000', // webhook message 'author'
			}),
		},
	},
	allowedMentions: { parse: ['users'], repliedUser: true },
	partials: [
		Partials.User, // reactions on uncached messages
		Partials.Channel, // DM channels
		Partials.GuildMember, // leave / update events for uncached members
		Partials.Message, // reactions on uncached messages
		Partials.Reaction, // reactions on uncached messages
		Partials.GuildScheduledEvent,
		Partials.ThreadMember,
	],
	failIfNotExists: false,
	presence: {
		activities: [
			{
				name: 'slash commands',
				type: ActivityType.Listening,
			},
		],
		status: PresenceUpdateStatus.Online,
	},
	intents:
		GatewayIntentBits.Guilds | // to populate guild and channel caches
		GatewayIntentBits.GuildMembers | // guildMemberAdd, remove
		GatewayIntentBits.GuildEmojisAndStickers | // to keep the cache updated for the chat bridge
		GatewayIntentBits.GuildMessages | // chat bridge
		GatewayIntentBits.GuildMessageReactions | // forward announcements to guild chat
		GatewayIntentBits.MessageContent, // chat bridge
	rest: {
		// don't await channel name and topic edits
		rejectOnRateLimit: ({ method, route, timeToReset }) =>
			method === RequestMethod.Patch && route === Routes.channel(':id') && timeToReset > seconds(30),
	},
	jsonTransformer: (x) => x,
});

startJobs(client);

// connect to Discord
await client.login();
