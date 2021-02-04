'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const fs = require('fs');
const { Constants } = require('discord.js');
const LunarClient = require('./src/structures/LunarClient');
const { requireAll } = require('./src/functions/files');
const { Config, closeConnectionAndExit } = require('./database/models/index');
const logger = require('./src/functions/logger');

// discord.js structure extensions
requireAll(path.join(__dirname, 'src', 'structures', 'extensions'));


// catch rejections
process
	.on('unhandledRejection', error => {
		logger.error('[UNCAUGHT PROMISE REJECTION]:', error);
	})
	.on('uncaughtException', error => {
		logger.error('[UNCAUGHT EXCEPTION]:', error);
		closeConnectionAndExit();
	})
	.on('SIGINT', closeConnectionAndExit);


// init
(async () => {

	// create log_buffer folder if it is non-existent
	const LOG_BUFFER_DIR = path.join(__dirname, 'log_buffer');

	if (!fs.existsSync(LOG_BUFFER_DIR)) {
		fs.mkdirSync(LOG_BUFFER_DIR);
		logger.debug('created \'log_buffer\' folder');
	}

	// create bot client
	const client = new LunarClient({
		// fetchAllMembers: true, // enable when discord.js removes that feature
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
				name: `${(await Config.findOne({ where: { key: 'PREFIX' } }))?.value}help`,
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
				// 'GUILD_WEBHOOKS',
			],
		},
	});

	// connect to Discord
	client.login().catch(error => {
		logger.error('[LOGIN ERROR]:', error);
		closeConnectionAndExit();
	});
})();
