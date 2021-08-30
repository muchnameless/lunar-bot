import { config } from 'dotenv';
import { fileURLToPath } from 'url';
config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
import { Intents, LimitedCollection, SnowflakeUtil, Options, Constants } from 'discord.js';
import { db } from './structures/database/index.js';
import { LunarClient } from './structures/LunarClient.js';
import { logger } from './functions/index.js';


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
				excludeFromSweep: e => e.id === e.client.config.get('TAX_MESSAGE_ID'),
			}),
		},
		ChannelManager: {
			sweepInterval: 3_600, // 1h
			sweepFilter: LimitedCollection.filterByLifetime({
				lifetime: 14_400, // 4h
				getComparisonTimestamp: e => (e.type === 'DM'
					? (e.lastMessageId ? SnowflakeUtil.deconstruct(e.lastMessageId).timestamp : -1) // DM -> last message
					: e.archiveTimestamp), // threads -> archived
				excludeFromSweep: e => e.type !== 'DM' && !e.archived,
			}),
		},
		PresenceManager: 0,
		ReactionUserManager: { // cache only the bot user
			maxSize: 1,
			keepOverLimit: e => e.id === e.client.user.id,
		},
		StageInstanceManager: 0,
		UserManager: {
			sweepInterval: 21_600, // 6h
			sweepFilter: LimitedCollection.filterByLifetime({
				lifetime: 1, // 0 cancles the filter
				getComparisonTimestamp: () => -1,
				excludeFromSweep: e => e.client.guilds.cache.some(guild => guild.members.cache.has(e.id)) // user is part of a member
					|| e.client.channels.cache.some(channel => channel.type === 'DM' && channel.recipient.id === e.id) // user has a DM channel
					|| e.discriminator === '0000', // webhook message 'author'
			}),
		},
		VoiceStateManager: 0,
	}),
	allowedMentions: { parse: [ 'users' ], repliedUser: true },
	partials: [
		Constants.PartialTypes.CHANNEL,
		// Constants.PartialTypes.GUILD_MEMBER,
		Constants.PartialTypes.MESSAGE,
		Constants.PartialTypes.REACTION,
		// Constants.PartialTypes.USER,
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
		Intents.FLAGS.DIRECT_MESSAGES,
		// Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
		// Intents.FLAGS.DIRECT_MESSAGE_TYPING,
		Intents.FLAGS.GUILDS,
		// Intents.FLAGS.GUILD_BANS,
		// Intents.FLAGS.GUILD_EMOJIS_AND_STICKERS,
		// Intents.FLAGS.GUILD_INTEGRATIONS,
		// Intents.FLAGS.GUILD_INVITES,
		Intents.FLAGS.GUILD_MEMBERS,
		Intents.FLAGS.GUILD_MESSAGES,
		Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
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
