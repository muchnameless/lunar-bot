'use strict';

const { DiscordAPIError } = require('discord.js');
const path = require('path');
const mineflayer = require('mineflayer');
const { getAllJsFiles } = require('../../functions/files');
const logger = require('../../functions/logger');


class ChatBridge {
	/**
	 * @param {import('../LunarClient')} client
	 */
	constructor(client) {
		this.client = client;
		this.webhook = null;
		this.bot = null;
		this.loginAttempts = 0;
		this.exactDelay = 0;

		this.abortConnectionTimeout = null;
	}

	/**
	 * wether the logging webhook is properly loaded and cached
	 */
	get webhookAvailable() {
		return Boolean(this.webhook);
	}

	/**
	 * fetch the webhook if it is uncached, create and log the bot into hypixel
	 */
	async connect() {
		this.client.clearTimeout(this.abortConnectionTimeout);

		if (!this.webhook) await this._fetchWebhook();
		this._createBot();
		this._loadEvents();

		this.abortConnectionTimeout = this.client.setTimeout(() => this.bot.quit('Relogging'), 60_000);
	}

	/**
	 * fetch the chat bridge webhook
	 */
	async _fetchWebhook() {
		if (this.client.config.getBoolean('CHATBRIDGE_WEBHOOK_DELETED')) return logger.warn('[CHATBRIDGE WEBHOOK]: deleted');

		try {
			const chatBridgeWebhook = await this.client.fetchWebhook(process.env.CHATBRIDGE_WEBHOOK_ID, process.env.CHATBRIDGE_WEBHOOK_TOKEN);

			this.webhook = chatBridgeWebhook;
		} catch (error) {
			if (error instanceof DiscordAPIError && error.method === 'get' && error.code === 0 && error.httpStatus === 404) this.client.config.set('CHATBRIDGE_WEBHOOK_DELETED', 'true');
			logger.error(`[CHATBRIDGE WEBHOOK]: ${error.name}: ${error.message}`);
		}
	}

	/**
	 * create bot instance and logs into hypixel
	 */
	_createBot() {
		this.bot = mineflayer.createBot({
			host: process.env.MINECRAFT_SERVER_HOST,
			port: Number(process.env.MINECRAFT_SERVER_PORT),
			username: process.env.MINECRAFT_USERNAME,
			password: process.env.MINECRAFT_PASSWORD,
			version: false,
			auth: process.env.MINECRAFT_ACCOUNT_TYPE,
		});
	}

	/**
	 * load bot events
	 */
	_loadEvents() {
		const eventFiles = getAllJsFiles(path.join(__dirname, 'events'));

		for (const file of eventFiles) {
			const event = require(file);
			const EVENT_NAME = path.basename(file, '.js');

			this.bot[EVENT_NAME === 'login' ? 'once' : 'on'](EVENT_NAME, event.bind(null, this.client, this.bot));

			delete require.cache[require.resolve(file)];
		}

		logger.debug(`[CHATBRIDGE EVENTS]: ${eventFiles.length} event${eventFiles.length !== 1 ? 's' : ''} loaded`);
	}

	/**
	 * escapes 'ez' and pads the input string with random invisible chars to bypass the hypixel spam filter
	 * @param {string} string
	 */
	_hypixelSpamBypass(string) {
		// escape 'ez'
		string = string.replace(/\b(e+)(z+)\b/gi, '$1ࠀ$2');

		// pad message with random invisible characters
		const invisChars = [ '⭍', 'ࠀ' ];

		// max message length is 256 with patcher or post 1.12, 100 without
		for (let index = 257 - string.length; --index;) {
			string += invisChars[Math.floor(Math.random() * invisChars.length)];
		}

		return string;
	}

	/**
	 * replaces discord renders with names
	 * @param {string} string
	 */
	_cleanContent(string) {
		return string
			.replace(/<?(a)?:?(\w{2,32}):(\d{17,19})>?/g, ':$2:') // emojis
			.replace(/<#(\d+)>/g, (match, p1) => { // channels
				const channelName = this.client.channels.cache.get(p1)?.name;
				if (channelName) return `#${channelName}`;
				return match;
			})
			.replace(/<@&(\d+)>/g, (match, p1) => { // roles
				const roleName = this.client.lgGuild?.roles.cache.get(p1)?.name;
				if (roleName) return `@${roleName}`;
				return match;
			})
			.replace(/<@!?(\d+)>/g, (match, p1) => { // users
				const displayName = this.client.lgGuild?.members.cache.get(p1)?.displayName ?? this.client.users.cache.get(p1)?.username;
				if (displayName) return `@${displayName}`;
				return match;
			});
	}

	/**
	 * converts a discord message to a minecraft message string for the bot to chat
	 * @param {import('../extensions/Message')} message
	 */
	_makeContent(message) {
		const player = this.client.players.getByID(message.author.id);

		return this._hypixelSpamBypass(`/gc ${player?.ign ?? message.member?.displayName ?? message.author.username}: ${this._cleanContent(message.content)}`.slice(0, 255));
	}

	/**
	 * realy a message to ingame guild chat, replacing emojis with :emojiName:
	 * @param {import('../extensions/Message')} message
	 */
	handleMessage(message) {
		// chatbridge disabled or no message.content to chat
		if (!this.client.config.getBoolean('CHATBRIDGE_ENABLED') || !message.content.length) return;

		try {
			this.bot.chat(this._makeContent(message));
		} catch (error) {
			logger.error(`[CHATBRIDGE MC CHAT]: ${error}`);
		}
	}
}

module.exports = ChatBridge;
