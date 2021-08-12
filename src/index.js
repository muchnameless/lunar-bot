'use strict';

const { join } = require('path');
require('dotenv').config({ path: join(__dirname, '.env') });
const { Intents, LimitedCollection, SnowflakeUtil, Options, Constants } = require('discord.js');
const db = require('./structures/database/index');
const LunarClient = require('./structures/LunarClient');
const logger = require('./functions/logger');

/** @type {LunarClient} */
let client;

// catch rejections
process
	.on('unhandledRejection', (error) => {
		logger.error('[UNCAUGHT PROMISE REJECTION]', error);
	})
	.on('uncaughtException', (error) => {
		logger.error('[UNCAUGHT EXCEPTION]', error);
		client?.exit(-1) ?? process.exit(-1);
	})
	.on('SIGINT', () => client?.exit(0) ?? process.exit(0));


// init
(async () => {
	// initiate bot client
	client = new LunarClient({
		// custom options
		db,
		fetchAllMembers: true,

		// default options
		makeCache: Options.cacheWithLimits({
			...Options.defaultMakeCacheSettings,
			MessageManager: {
				maxSize: 200,
				sweepInterval: 600,
				sweepFilter: LimitedCollection.filterByLifetime({
					lifetime: 1_800,
					getComparisonTimestamp: e => e.editedTimestamp ?? e.createdTimestamp,
					excludeFromSweep: e => e.id === e.client.config.get('TAX_MESSAGE_ID'),
				}),
			},
			ChannelManager: {
				sweepInterval: 3_600,
				sweepFilter: LimitedCollection.filterByLifetime({
					lifetime: 14_400,
					getComparisonTimestamp: e => (e.type === 'DM'
						? (e.lastMessageId ? SnowflakeUtil.deconstruct(e.lastMessageId).timestamp : -1) // DM -> last message
						: e.archiveTimestamp), // threads -> archived
					excludeFromSweep: e => e.type !== 'DM' && !e.archived,
				}),
			},
			UserManager: {
				sweepInterval: 21_600,
				sweepFilter: LimitedCollection.filterByLifetime({
					lifetime: 0,
					getComparisonTimestamp: () => -1,
					excludeFromSweep: e => e.client.guilds.cache.some(guild => guild.members.cache.has(e.id)) || e.client.channels.cache.some(channel => channel.type === 'DM' && channel.recipient.id === e.id),
				}),
			},
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

	// connect to Discord
	await client.login();
})();
