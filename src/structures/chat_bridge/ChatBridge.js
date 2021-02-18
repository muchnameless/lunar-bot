'use strict';

const { Util } = require('discord.js');
const path = require('path');
const mineflayer = require('mineflayer');
const emojiRegex = require('emoji-regex');
const ms = require('ms');
const { sleep } = require('../../functions/util');
const { getAllJsFiles } = require('../../functions/files');
const { unicodeToName, nameToUnicode } = require('../../constants/emojiNameUnicodeConverter');
const AsyncQueue = require('../AsyncQueue');
const logger = require('../../functions/logger');


class ChatBridge {
	/**
	 * @param {import('../LunarClient')} client
	 */
	constructor(client, mcAccount) {
		this.client = client;
		this.mcAccount = mcAccount;
		this.webhook = null;
		/**
		 * @type {import('../database/models/HypixelGuild')}
		 */
		this.guild = null;
		this.bot = null;
		this.ready = false;
		this.loginAttempts = 0;
		/**
		 * disconnect the bot if it hasn't successfully spawned in 60 seconds
		 */
		this.abortLoginTimeout = null;
		this.queue = new AsyncQueue();
		this.maxMessageLength = 100;
	}

	/**
	 * fetch the webhook if it is uncached, create and log the bot into hypixel
	 */
	async connect() {
		this.bot = this._createBot();
		this._loadEvents();

		// disconnect the bot if it hasn't successfully spawned in 60 seconds
		this.abortLoginTimeout = setTimeout(() => {
			logger.warn('[CHATBRIDGE ABORT TIMER]: login abort triggered');
			this.reconnect(0);
		}, Math.min(++this.loginAttempts * 60_000, 300_000));
	}

	/**
	 * destroys the connection to the guild and reconnects the bot
	 */
	reconnect(loginDelay) {
		this._reset();

		try {
			this.bot.quit();
		} catch (err) {
			logger.error('[CHATBRIDGE ERROR]:', err);
		}

		loginDelay ??= Math.min(++this.loginAttempts * 5_000, 300_000);

		logger.warn(`[CHATBRIDGE RECONNECT]: attempting reconnect in ${ms(loginDelay, { long: true })}`);

		setTimeout(() => this.connect(), loginDelay);
	}

	/**
	 * disconnects the bot
	 */
	disconnect() {
		this._reset();

		try {
			this.bot.quit();
		} catch (err) {
			logger.error('[CHATBRIDGE ERROR]:', err);
		}
	}

	/**
	 * resets the chat bridge
	 */
	_reset() {
		this.ready = false;
		if (this.guild) this.guild.chatBridge = null;
		this.guild = null;
		clearTimeout(this.abortLoginTimeout);
	}

	/**
	 * fetches the chat bridge discord webhook
	 */
	async fetchAndCacheWebhook() {
		if (this.webhook) return this.ready = true;
		if (!this.guild) return logger.warn(`[CHATBRIDGE]: chatBridge #${this.mcAccount}: no guild to fetch webhook`);

		try {
			const channel = this.client.channels.cache.get(this.guild.chatBridgeChannelID);

			if (!channel) return logger.warn(`[CHATBRIDGE]: ${this.guild.name}: unknown channel: ${this.guild.chatBridgeChannelID}`);
			if (!channel.checkBotPermissions('MANAGE_WEBHOOKS')) return logger.warn(`[CHATBRIDGE]: ${this.guild.name}: missing 'MANAGE_WEBHOOKS' in #${channel.name}`);

			const webhooks = await channel.fetchWebhooks();

			if (!webhooks.size) return logger.warn(`[CHATBRIDGE]: ${this.guild.name}: no webhooks found in #${channel.name}`);

			this.webhook = webhooks.first();
			this.ready = true;
		} catch (error) {
			logger.error(`[CHATBRIDGE]: ${this.guild.name}: error fetching webhook: ${error.name}: ${error.message}`);
			this.ready = false;
		}
	}

	/**
	 * uncaches the webhook
	 */
	uncacheWebhook() {
		this.webhook = null;
		this.ready = false;
	}

	/**
	 * create bot instance and logs into hypixel
	 */
	_createBot() {
		return mineflayer.createBot({
			host: process.env.MINECRAFT_SERVER_HOST,
			port: Number(process.env.MINECRAFT_SERVER_PORT),
			username: process.env.MINECRAFT_USERNAME.split(' ')[this.mcAccount],
			password: process.env.MINECRAFT_PASSWORD.split(' ')[this.mcAccount],
			version: false,
			auth: process.env.MINECRAFT_ACCOUNT_TYPE.split(' ')[this.mcAccount],
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
	 * prettify message for discord, tries to replace :emoji: and others with the actually working discord render string
	 * @param {string} message
	 */
	parseMinecraftMessageToDiscord(message) {
		return Util.escapeMarkdown(message)
			.replace(/:(.+):/, (match, p1) => this.client.emojis.cache.find(e => e.name.toLowerCase() === p1.toLowerCase())?.toString() ?? nameToUnicode[p1] ?? match) // emojis (custom and default)
			.replace(/<?#([a-z-]+)>?/gi, (match, p1) => this.client.channels.cache.find(ch => ch.name === p1.toLowerCase())?.toString() ?? match) // channels
			.replace(/<?@[!&]?(\S+)>?/g, (match, p1) =>
				this.client.lgGuild?.members.cache.find(m => m.displayName.toLowerCase() === p1.toLowerCase())?.toString() // members
				?? this.client.users.cache.find(u => u.username.toLowerCase() === p1.toLowerCase())?.toString() // users
				?? this.client.lgGuild?.roles.cache.find(r => r.name.toLowerCase() === p1.toLowerCase())?.toString() // roles
				?? match,
			);
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
	static _parseDiscordMessageToMinecraft(string) {
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
		const toSend = this.constructor._escapeEz(this.constructor._parseDiscordMessageToMinecraft(message.content));

		for (const contentPart of Util.splitMessage(toSend, { maxLength: this.maxMessageLength - prefix.length })) {
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
