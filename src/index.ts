import { env } from 'node:process';
import { URL } from 'node:url';
import {
	ActivityType,
	ChannelType,
	disableValidators,
	GatewayIntentBits,
	lazy,
	Options,
	Partials,
	PresenceUpdateStatus,
	RequestMethod,
	Routes,
	type Snowflake,
} from 'discord.js';
import { Agent, setGlobalDispatcher } from 'undici';
import { hours, minutes, seconds } from '#functions';
import { startJobs } from '#root/jobs/index.js';
import { LunarClient } from '#structures/LunarClient.js';

setGlobalDispatcher(new Agent({ connect: { timeout: 30_000 } }));

if (env.NODE_ENV !== 'development') disableValidators();

const client = new LunarClient({
	// custom
	applicationCommands: new URL('commands/', import.meta.url),
	chatBridgeCommands: new URL('lib/chatBridge/commands/', import.meta.url),
	events: new URL('events/', import.meta.url),
	logBuffer: new URL('../log_buffer/', import.meta.url),

	// discord.js
	makeCache: Options.cacheWithLimits({
		...Options.DefaultMakeCacheSettings,
		GuildBanManager: 0,
		GuildInviteManager: 0,
		GuildScheduledEventManager: 0,
		PresenceManager: 0,
		ReactionUserManager: {
			// cache only the bot user
			maxSize: 1,
			keepOverLimit: (user) => user.id === user.client.user.id,
		},
		StageInstanceManager: 0,
		VoiceStateManager: 0,
	}),
	sweepers: {
		...Options.DefaultSweeperSettings,
		messages: {
			interval: seconds.fromMilliseconds(minutes(10)),
			filter() {
				const TAX_MESSAGE_ID = client.config.get('TAX_MESSAGE_ID');
				const now = Date.now();
				const lifetime = minutes(30);

				return (entry, key) => {
					if (key === TAX_MESSAGE_ID) return false;
					return now - (entry.editedTimestamp ?? entry.createdTimestamp) > lifetime;
				};
			},
		},
		users: {
			interval: seconds.fromMilliseconds(hours(6)),
			filter() {
				const dmChannelRecipients = lazy(() => {
					const recipients = new Set<Snowflake>();
					for (const channel of client.channels.cache.values()) {
						if (channel.type === ChannelType.DM) recipients.add(channel.recipientId);
					}

					return recipients;
				});

				return (user, userId) =>
					!user.client.guilds.cache.some((guild) => guild.members.cache.has(userId)) && // user is part of a member
					user.discriminator !== '0000' && // webhook message "author"
					!dmChannelRecipients().has(userId); // user has a cached DM channel
			},
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
		GatewayIntentBits.DirectMessages |
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
