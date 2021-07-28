'use strict';

const { join } = require('path');
require('dotenv').config({ path: join(__dirname, '.env') });
const { Collection, Intents, Constants } = require('discord.js');
const { requireAll } = require('./functions/files');
const db = require('./structures/database/index');
const LunarClient = require('./structures/LunarClient');
const MessageCacheCollection = require('./structures/MessageCacheCollection');
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
	// discord.js structure extensions
	await requireAll(join(__dirname, 'structures', 'extensions'));

	// initiate bot client
	client = new LunarClient({
		// custom options
		db,
		fetchAllMembers: true,

		// default options
		makeCache({ name }) {
			switch (name) {
				case 'MessageManager':
					return new MessageCacheCollection(50);

				default:
					return new Collection();
			}
		},
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
				type: 'LISTENING',
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
