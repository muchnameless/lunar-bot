'use strict';

const { join } = require('path');
require('dotenv').config({ path: join(__dirname, '.env') });
const { Constants, Intents } = require('discord.js');
const { requireAll } = require('./src/functions/files');
const db = require('./src/structures/database/index');
const LunarClient = require('./src/structures/LunarClient');
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
		restTimeOffset: 0,
		fetchAllMembers: true,
		allowedMentions: { parse: [ 'users', 'roles' ], repliedUser: true },
		partials: [
			Constants.PartialTypes.CHANNEL,
			// Constants.PartialTypes.GUILD_MEMBER,
			Constants.PartialTypes.MESSAGE,
			Constants.PartialTypes.REACTION,
			// Constants.PartialTypes.USER,
		],
		presence: {
			activities: [{
				name: `${(await db.Config.findOne({ where: { key: 'PREFIX' } }))?.value ?? 'lg!'}help`,
				type: 'LISTENING',
			}],
			status: 'online',
		},
		intents: [
			Intents.FLAGS.DIRECT_MESSAGES,
			Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
			// Intents.FLAGS.DIRECT_MESSAGE_TYPING,
			Intents.FLAGS.GUILDS,
			// Intents.FLAGS.GUILD_BANS,
			// Intents.FLAGS.GUILD_EMOJIS,
			// Intents.FLAGS.GUILD_INTEGRATIONS,
			// Intents.FLAGS.GUILD_INVITES,
			Intents.FLAGS.GUILD_MEMBERS,
			Intents.FLAGS.GUILD_MESSAGES,
			Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
			// Intents.FLAGS.GUILD_MESSAGE_TYPING,
			// Intents.FLAGS.GUILD_PRESENCES,
			// Intents.FLAGS.GUILD_VOICE_STATES,
			Intents.FLAGS.GUILD_WEBHOOKS,
		],
	});

	// connect to Discord
	client.login().catch((error) => {
		logger.error('[INIT]: login error', error);
		client.exit(1);
	});
})();
