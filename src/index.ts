import { Intents, LimitedCollection, SnowflakeUtil, Options, Constants } from 'discord.js';
import { db } from './structures/database';
import { LunarClient } from './structures/LunarClient';
import { logger } from './functions';
import type { Channel, DMChannel, ThreadChannel } from 'discord.js';


const client = new LunarClient({
	// custom options
	db,
	fetchAllMembers: true,

	// default options
	makeCache: Options.cacheWithLimits({
		...Options.defaultMakeCacheSettings,
		MessageManager: {
			maxSize: 200,
			sweepInterval: 600, // 10 min
			sweepFilter: LimitedCollection.filterByLifetime({
				lifetime: 1_800, // 30 min
				getComparisonTimestamp: e => e.editedTimestamp ?? e.createdTimestamp,
				excludeFromSweep: e => e.id === (e.client as LunarClient).config.get('TAX_MESSAGE_ID'),
			}),
		},
		// @ts-expect-error sweeping ChannelManager is not yet suppported
		ChannelManager: {
			sweepInterval: 3_600, // 1h
			sweepFilter: LimitedCollection.filterByLifetime({
				lifetime: 14_400, // 4h
				getComparisonTimestamp(e: Channel) {
					if (e.type === 'DM') { // DM -> last message
						return (e as DMChannel).lastMessageId
							? SnowflakeUtil.deconstruct((e as DMChannel).lastMessageId!).timestamp
							: -1;
					}
					return (e as ThreadChannel).archiveTimestamp ?? -1; // threads -> archived
				},
				excludeFromSweep: e => e.type !== 'DM' && !(e as ThreadChannel).archived,
			}),
		},
		PresenceManager: 0,
		ReactionUserManager: { // cache only the bot user
			maxSize: 1,
			keepOverLimit: e => e.id === e.client.user!.id,
		},
		StageInstanceManager: 0,
		UserManager: {
			sweepInterval: 21_600, // 6h
			sweepFilter: LimitedCollection.filterByLifetime({
				lifetime: 1, // 0 cancles the filter
				getComparisonTimestamp: () => -1,
				excludeFromSweep: e => e.client.guilds.cache.some(guild => guild.members.cache.has(e.id)) // user is part of a member
					|| e.client.channels.cache.some(channel => channel.type === 'DM' && (channel as DMChannel).recipient.id === e.id) // user has a DM channel
					|| e.discriminator === '0000', // webhook message 'author'
			}),
		},
		VoiceStateManager: 0,
	}),
	allowedMentions: { parse: [ 'users' ], repliedUser: true },
	partials: [
		Constants.PartialTypes.CHANNEL, // DM channels
		Constants.PartialTypes.GUILD_MEMBER,
		Constants.PartialTypes.MESSAGE,
		Constants.PartialTypes.REACTION, // reactions on uncached messages
		Constants.PartialTypes.USER,
	],
	failIfNotExists: false,
	presence: {
		activities: [{
			name: 'slash commands',
			type: Constants.ActivityTypes.LISTENING,
		}],
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
		logger.error('[UNCAUGHT PROMISE REJECTION]', error);
	})
	.on('uncaughtException', (error) => {
		logger.error('[UNCAUGHT EXCEPTION]', error);
		client.exit(-1);
	})
	.on('SIGINT', () => client.exit(0));


// connect to Discord
await client.login();
