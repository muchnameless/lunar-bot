'use strict';

const { Util, DiscordAPIError } = require('discord.js');
const PROTO_VER_1_10 = require('minecraft-data')('1.10.2').version.version;
const path = require('path');
const mineflayer = require('mineflayer');
const emojiRegex = require('emoji-regex');
const ms = require('ms');
const { sleep } = require('../../functions/util');
const { getAllJsFiles } = require('../../functions/files');
const { unicodeToName } = require('../../constants/emojiNameUnicodeConverter');
const AsyncQueue = require('../AsyncQueue');
const logger = require('../../functions/logger');


class ChatBridge {
	/**
	 * @param {import('../LunarClient')} client
	 */
	constructor(client) {
		this.client = client;
		this.webhook = null;
		/**
		 * @type {import('../database/models/HypixelGuild')}
		 */
		this.guild = null;
		this.bot = null;
		this.ready = false;
		this.loginAttempts = 0;
		this._timeouts = new Set();
		/**
		 * disconnect the bot if it hasn't successfully spawned in 60 seconds
		 */
		this.abortConnectionTimeout = null;
		this.queue = new AsyncQueue();
		this.maxMessageLength = 100;
	}

	/**
	 * fetch the webhook if it is uncached, create and log the bot into hypixel
	 */
	async connect() {
		if (!this.webhook) await this._fetchWebhook();
		this.bot = this._createBot();
		this.maxMessageLength = this.bot.protocolVersion > PROTO_VER_1_10 ? 256 : 100;
		this._loadEvents();

		// disconnect the bot if it hasn't successfully spawned in 60 seconds
		this.abortConnectionTimeout = setTimeout(() => this.bot.quit('Relogging'), 60_000);
	}

	/**
	 * destroys the connection to the guild and reconnects the bot
	 */
	reconnect() {
		this.ready = false;
		if (this.guild) this.guild.chatBridge = null;
		this.guild = null;

		const LOGIN_DELAY = Math.min((this.loginAttempts + 1) * 5_000, 60_000);

		logger.warn(`[CHATBRIDGE RECONNECT]: attempting reconnect in ${ms(LOGIN_DELAY, { long: true })}`);

		this.client.setTimeout(() => this.connect(), LOGIN_DELAY);
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
		return mineflayer.createBot({
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

			this.bot[[ 'login', 'spawn' ].includes(EVENT_NAME) ? 'once' : 'on'](EVENT_NAME, event.bind(null, this));
		}

		logger.debug(`[CHATBRIDGE EVENTS]: ${eventFiles.length} event${eventFiles.length !== 1 ? 's' : ''} loaded`);
	}

	/**
	 * pads the input string with random invisible chars to bypass the hypixel spam filter
	 * @param {string} string
	 */
	hypixelSpamBypass(string) {
		const invisChars = [ '⭍', 'ࠀ' ]; // those don't render in the mc client

		// max message length is 256 post 1.11, 100 pre 1.11
		for (let index = 0; index < this.maxMessageLength - string.length; ++index) {
			string += invisChars[Math.floor(Math.random() * invisChars.length)];
		}

		return string;
	}

	/**
	 * escapes all standalone occurrences of 'ez', case-insensitive
	 * @param {string} string
	 */
	static _escapeEz(string) {
		return string.replace(/(?<=\be+)(?=z+\b)/gi, 'ࠀ');
	}

	/**
	 * replaces discord renders with names
	 * @param {string} string
	 */
	static _prettifyDiscordMentions(string) {
		return string
			.replace(/<?(a)?:?(\w{2,32}):(\d{17,19})>?/g, ':$2:') // custom emojis
			.replace(emojiRegex(), match => unicodeToName[match] ?? match) // default emojis
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
	 * realy a message to ingame guild chat, replacing emojis with :emojiName:
	 * @param {import('../extensions/Message')} message
	 * @param {import('../database/models/Player')} player
	 */
	sendToHypixelGuildChat(message, player) {
		const prefix = `/gc ${player?.ign ?? this.constructor._escapeEz(message.member?.displayName ?? message.author.username)}: `;
		const toSend = this.constructor._escapeEz(this.constructor._prettifyDiscordMentions(message.content));

		for (const contentPart of Util.splitMessage(toSend, { maxLength: this.maxMessageLength })) {
			this.chat(this.hypixelSpamBypass(`${prefix}${contentPart}`));
		}
	}

	/**
	 * send a message to the ingame chat, 600 ms queue cooldown
	 * @param {string} message
	 */
	async chat(message) {
		if (!this.ready) throw new Error('chat bridge bot not online');

		await this.queue.wait();

		try {
			if (!this.ready) return;
			this.bot.chat(message);
			await sleep(600); // sends each part 600 ms apart ('you can only send a message once every half second')
		} catch (error) {
			logger.error(`[CHATBRIDGE MC CHAT]: ${error}`);
		} finally {
			this.queue.shift();
		}
	}
}

module.exports = ChatBridge;
