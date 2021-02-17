'use strict';

const { Util, DiscordAPIError } = require('discord.js');
const PROTO_VER_1_10 = require('minecraft-data')('1.10.2').version.version;
const path = require('path');
const mineflayer = require('mineflayer');
const emojiRegex = require('emoji-regex');
const { getAllJsFiles } = require('../../functions/files');
const { unicodeToName } = require('../../constants/emojiNameUnicodeConverter');
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

		this.guildID = '5eeec8c08ea8c950b6cb6a19';

		this._timeouts = new Set();
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
		if (!this.webhook) await this._fetchWebhook();
		this._createBot();
		this._loadEvents();

		this.abortConnectionTimeout = this.client.setTimeout(() => this.bot.quit('Relogging'), 60_000);
	}

	/**
	 * clears all timeouts
	 */
	clearAllTimeouts() {
		this.client.clearTimeout(this.abortConnectionTimeout);
		for (const t of this._timeouts) this.clearTimeout(t);
	}

	/**
	 * Sets a timeout that will be automatically cancelled if the client is destroyed.
	 * @param {Function} fn Function to execute
	 * @param {number} delay Time to wait before executing (in milliseconds)
	 * @param {...*} args Arguments for the function
	 * @returns {Timeout}
	 */
	setTimeout(fn, delay, ...args) {
		const timeout = setTimeout(() => {
			fn(...args);
			this._timeouts.delete(timeout);
		}, delay);
		this._timeouts.add(timeout);
		return timeout;
	}

	/**
	 * Clears a timeout.
	 * @param {Timeout} timeout Timeout to cancel
	 */
	clearTimeout(timeout) {
		clearTimeout(timeout);
		this._timeouts.delete(timeout);
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

			this.bot[[ 'login', 'spawn' ].includes(EVENT_NAME) ? 'once' : 'on'](EVENT_NAME, event.bind(null, this.client, this.bot));
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
		for (let index = 0; index < ((this.bot.protocolVersion > PROTO_VER_1_10) ? 256 : 100) - string.length; ++index) {
			string += invisChars[Math.floor(Math.random() * invisChars.length)];
		}

		return string;
	}

	/**
	 * escapes all standalone occurrences of 'ez', case-insensitive
	 * @param {string} string
	 */
	_escapeEz(string) {
		return string.replace(/(?<=\be+)(?=z+\b)/gi, 'ࠀ');
	}

	/**
	 * replaces discord renders with names
	 * @param {string} string
	 */
	_cleanDiscordMentions(string) {
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
	 * converts a discord message to a minecraft message string for the bot to chat
	 * @param {import('../extensions/Message')} message
	 * @param {import('../database/models/Player')} player
	 */
	_makeContent(message, player) {
		const prefix = this._escapeEz(`/gc ${player?.ign ?? message.member?.displayName ?? message.author.username}: `);
		const toSend = this._escapeEz(this._cleanDiscordMentions(message.content));

		return Util.splitMessage(toSend, { maxLength: 256 }).map(contentPart => this.hypixelSpamBypass(`${prefix}${contentPart}`));
	}

	/**
	 * realy a message to ingame guild chat, replacing emojis with :emojiName:
	 * @param {import('../extensions/Message')} message
	 */
	handleDiscordMessage(message) {
		// chatbridge disabled or no message.content to chat
		if (!this.client.config.getBoolean('CHATBRIDGE_ENABLED') || !message.content.length) return;

		const player = this.client.players.getByID(message.author.id);

		// check if muted
		if (player.chatBridgeMutedUntil) {
			if (Date.now() < player.chatBridgeMutedUntil) { // mute hasn't expired
				return message.author.send(`you are currently muted ${player.chatBridgeMutedUntil ? `until ${new Date(player.chatBridgeMutedUntil).toUTCString()}` : 'for an unspecified amount of time'}`).then(
					() => logger.info(`[CHATBRIDGE]: ${player.info}: DMed muted user`),
					error => logger.error(`[CHATBRIDGE]: ${player.info}: error DMing muted user: ${error.name}: ${error.message}`),
				);
			}

			player.chatBridgeMutedUntil = 0;
			player.save();
		}

		try {
			this._makeContent(message, player).forEach((contentPart, index) => {
				// sends each part 550 ms (approx 11 ticks) apart
				this.setTimeout(this.bot.chat, index * 550, contentPart);
			});
		} catch (error) {
			logger.error(`[CHATBRIDGE MC CHAT]: ${error}`);
		}
	}
}

module.exports = ChatBridge;
