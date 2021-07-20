'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { Client, Intents, Constants } = require('discord.js');
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
			// Intents.FLAGS.GUILD_EMOJIS_AND_STICKERS,
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

	let prefixRegExp;

	client
		.once(Constants.Events.CLIENT_READY, () => {
			prefixRegExp = new RegExp(`^(?:${[ PREFIX && escapeRegex(PREFIX), `<@!?${client.user.id}>` ].filter(Boolean).join('|')})`, 'i');

			setInterval(() => {
				client.user.setPresence(presence);
			}, 20 * 60_000).unref(); // 20 min

			// log
			logger.info(`Startup complete. Logged in as ${client.user.tag}`);
		})
		.on(Constants.Events.MESSAGE_CREATE, async (message) => {
			if (message.author.bot || message.system || message.webhookId) return; // filter out bot, system & webhook messages
			if (message.guild && !prefixRegExp.test(message.content)) return; // allow PREFIX and @bot.id

			logger.info(`${message.author.tag}${message.guild ? ` | ${message.member.displayName}` : ''} tried to execute ${message.content} during maintenance`);

			try {
				await message.reply(`${client.user} is currently unavailable due to maintenance`);
			} catch (error) {
				logger.error(error);
			}
		})
		.on(Constants.Events.INTERACTION_CREATE, async (interaction) => {
			if (!interaction.isCommand() && !interaction.isMessageComponent()) return;

			logger.info(`${interaction.user.tag}${interaction.guild ? ` | ${interaction.member.displayName}` : ''} tried to execute ${interaction.commandName ?? interaction.customId} during maintenance`);

			try {
				await interaction.reply({
					content: `${client.user} is currently unavailable due to maintenance`,
					ephemeral: true,
				});
			} catch (error) {
				logger.error(error);
			}
		})
		.login();
})();
