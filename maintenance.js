'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { Client } = require('discord.js');
const { escapeRegex } = require('./src/functions/util');
const db = require('./src/structures/database/index');
const logger = require('./src/functions/logger');


// catch rejections
process
	.on('unhandledRejection', (error) => {
		logger.error('[UNCAUGHT PROMISE REJECTION]:', error);
	})
	.on('uncaughtException', (error) => {
		logger.error('[UNCAUGHT EXCEPTION]:', error);
		process.exit(1);
	});


// init
(async () => {
	const PREFIX = (await db.Config
		.findOne({
			where: {
				key: 'PREFIX',
			},
		}).catch(logger.error)
	)?.value;

	db.sequelize.close().catch(logger.error);

	const presence = { activity: { name: 'nothing due to maintenance', type: 'LISTENING' }, status: 'dnd' };
	const client = new Client({
		disableMentions: 'everyone',
		presence,
		ws: {
			intents: [
				'DIRECT_MESSAGES',
				// 'DIRECT_MESSAGE_REACTIONS',
				// 'DIRECT_MESSAGE_TYPING',
				'GUILDS',
				// 'GUILD_BANS',
				// 'GUILD_EMOJIS',
				// 'GUILD_INTEGRATIONS',
				// 'GUILD_INVITES',
				// 'GUILD_MEMBERS',
				'GUILD_MESSAGES',
				// 'GUILD_MESSAGE_REACTIONS',
				// 'GUILD_MESSAGE_TYPING',
				// 'GUILD_PRESENCES',
				// 'GUILD_VOICE_STATES',
				// 'GUILD_WEBHOOKS',
			],
		},
	});

	const prefixRegex = new RegExp(`^(?:${[ PREFIX && escapeRegex(PREFIX), `<@!?${client.user.id}>` ].filter(Boolean).join('|')})`, 'i'); // allow PREFIX and @bot.id

	// ready
	client.once('ready', () => {
		client.setInterval(() => {
			client.user.setPresence(presence).catch(error => logger.error('error while setting activity:\n', error));
		}, 20 * 60_000); // 20 min

		// log
		logger.info(`Startup complete. Logged in as ${client.user.tag}`);
	});

	// message
	client.on('message', async (message) => {
		if (message.author.bot || message.system || message.webhookID) return; // filter out bot, system & webhook messages
		if (message.guild && !prefixRegex.test(message)) return;

		message.reply(`${client.user} is currently unavailable due to maintenance.`);
		logger.info(`${message.author.tag}${message.guild ? ` | ${message.member.displayName}` : ''} tried to execute ${message.content} during maintenance`);
	});

	// connect to Discord
	client.login();
})();
