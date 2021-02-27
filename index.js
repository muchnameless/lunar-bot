'use strict';

const { join } = require('path');
require('dotenv').config({ path: join(__dirname, '.env') });
const { Constants } = require('discord.js');
const { requireAll } = require('./src/functions/files');
const db = require('./src/structures/database/index');
const LunarClient = require('./src/structures/LunarClient');
const logger = require('./src/functions/logger');


// catch rejections
process
	.on('unhandledRejection', error => {
		logger.error('[UNCAUGHT PROMISE REJECTION]:', error);
	})
	.on('uncaughtException', error => {
		logger.error('[UNCAUGHT EXCEPTION]:', error);
		db.closeConnectionAndExit();
	})
	.on('SIGINT', db.closeConnectionAndExit);


// init
(async () => {
	// discord.js structure extensions
	await requireAll(join(__dirname, 'src', 'structures', 'extensions'));

	// initiate bot client
	const client = new LunarClient({
		db,
		restTimeOffset: 0,
		messageEditHistoryMaxSize: 0,
		fetchAllMembers: true, // enable when discord.js removes that feature
		disableMentions: 'everyone',
		partials: [
			Constants.PartialTypes.CHANNEL,
			// Constants.PartialTypes.GUILD_MEMBER,
			Constants.PartialTypes.MESSAGE,
			Constants.PartialTypes.REACTION,
			// Constants.PartialTypes.USER,
		],
		presence: {
			activity: {
				name: `${(await db.Config.findOne({ where: { key: 'PREFIX' } }))?.value}help`,
				type: 'LISTENING',
			},
			status: 'online',
		},
		ws: {
			intents: [
				'DIRECT_MESSAGES',
				'DIRECT_MESSAGE_REACTIONS',
				// 'DIRECT_MESSAGE_TYPING',
				'GUILDS',
				// 'GUILD_BANS',
				// 'GUILD_EMOJIS',
				// 'GUILD_INTEGRATIONS',
				// 'GUILD_INVITES',
				'GUILD_MEMBERS',
				'GUILD_MESSAGES',
				'GUILD_MESSAGE_REACTIONS',
				// 'GUILD_MESSAGE_TYPING',
				// 'GUILD_PRESENCES',
				// 'GUILD_VOICE_STATES',
				'GUILD_WEBHOOKS',
			],
		},
	});

	// connect to Discord
	client.login().catch(error => {
		logger.error('[INIT]: login error:', error);
		db.closeConnectionAndExit();
	});
})();
