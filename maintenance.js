'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { Client, Intents } = require('discord.js');
const { escapeRegex } = require('./src/functions/util');
const db = require('./src/structures/database/index');
const logger = require('./src/functions/logger');


// catch rejections
process
	.on('unhandledRejection', (error) => {
		logger.error('[UNCAUGHT PROMISE REJECTION]', error);
	})
	.on('uncaughtException', (error) => {
		logger.error('[UNCAUGHT EXCEPTION]', error);
		process.exit(1);
	});


// init
(async () => {
	const PREFIX = (await db.Config.findOne({
		where: {
			key: 'PREFIX',
		},
	}))?.value ?? 'lg!';

	db.sequelize.close().catch(logger.error);

	const presence = {
		activities: [{
			name: 'nothing due to maintenance',
			type: 'LISTENING',
		}],
		status: 'dnd',
	};
	const client = new Client({
		disableMentions: 'everyone',
		presence,
		intents: [
			Intents.FLAGS.DIRECT_MESSAGES,
			// Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
			// Intents.FLAGS.DIRECT_MESSAGE_TYPING,
			Intents.FLAGS.GUILDS,
			// Intents.FLAGS.GUILD_BANS,
			// Intents.FLAGS.GUILD_EMOJIS,
			// Intents.FLAGS.GUILD_INTEGRATIONS,
			// Intents.FLAGS.GUILD_INVITES,
			// Intents.FLAGS.GUILD_MEMBERS,
			Intents.FLAGS.GUILD_MESSAGES,
			// Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
			// Intents.FLAGS.GUILD_MESSAGE_TYPING,
			// Intents.FLAGS.GUILD_PRESENCES,
			// Intents.FLAGS.GUILD_VOICE_STATES,
			// Intents.FLAGS.GUILD_WEBHOOKS,
		],
	});

	// ready
	client.once('ready', () => {
		client.setInterval(() => {
			client.user.setPresence(presence);
		}, 20 * 60_000); // 20 min

		// log
		logger.info(`Startup complete. Logged in as ${client.user.tag}`);
	});

	// message
	client.on('message', async (message) => {
		if (message.author.bot || message.system || message.webhookId) return; // filter out bot, system & webhook messages
		if (message.guild && !new RegExp(`^(?:${[ PREFIX && escapeRegex(PREFIX), `<@!?${client.user.id}>` ].filter(Boolean).join('|')})`, 'i').test(message.content)) return; // allow PREFIX and @bot.id

		message.reply(`${client.user} is currently unavailable due to maintenance`);
		logger.info(`${message.author.tag}${message.guild ? ` | ${message.member.displayName}` : ''} tried to execute ${message.content} during maintenance`);
	});

	// connect to Discord
	client.login();
})();
