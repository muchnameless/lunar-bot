'use strict';

const { join } = require('path');
require('dotenv').config({ path: join(__dirname, '.env') });
const { Collection, Intents, Constants } = require('discord.js');
const { requireAll } = require('./src/functions/files');
const db = require('./src/structures/database/index');
const LunarClient = require('./src/structures/LunarClient');
const MessageCacheCollection = require('./src/structures/collections/MessageCacheCollection');
const ChannelCacheCollection = require('./src/structures/collections/ChannelCacheCollection');
const logger = require('./src/functions/logger');

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
	// discord.js structure extensions
	await requireAll(join(__dirname, 'src', 'structures', 'extensions'));

	// initiate bot client
	client = new LunarClient({
		db,
		fetchAllMembers: true,
		failIfNotExists: false,
		allowedMentions: { parse: [ 'users' ], repliedUser: true },
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
		makeCache({ name }) {
			switch (name) {
				case 'MessageManager':
					return new MessageCacheCollection(50);

				case 'ChannelManager':
					return new ChannelCacheCollection();

				default:
					return new Collection();
			}
		},
		partials: [
			Constants.PartialTypes.CHANNEL,
			// Constants.PartialTypes.GUILD_MEMBER,
			Constants.PartialTypes.MESSAGE,
			Constants.PartialTypes.REACTION,
			// Constants.PartialTypes.USER,
		],
		presence: {
			activities: [{
				name: 'slash commands',
				type: 'LISTENING',
			}],
			status: 'online',
		},
	});

	// connect to Discord
	await client.login();
})();
