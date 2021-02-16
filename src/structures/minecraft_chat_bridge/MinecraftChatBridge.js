'use strict';

const { DiscordAPIError } = require('discord.js');
const path = require('path');
const mineflayer = require('mineflayer');
const { getAllJsFiles } = require('../../functions/files');
const logger = require('../../functions/logger');


class MinecraftChatBridge {
	/**
	 * @param {import('../LunarClient')} client
	 */
	constructor(client) {
		this.client = client;
		this.webhook = null;
		this.bot = null;
		this.loginAttempts = 0;
	}

	/**
	 * wether the logging webhook is properly loaded and cached
	 */
	get webhookAvailable() {
		return Boolean(this.webhook);
	}

	async connect() {
		if (!this.webhook) await this.fetchWebhook();
		this._createBot();
		this._loadEvents();
	}

	async fetchWebhook() {
		if (this.client.config.getBoolean('CHATBRIDGE_WEBHOOK_DELETED')) return logger.warn('[CHATBRIDGE WEBHOOK]: deleted');

		try {
			const chatBridgeWebhook = await this.client.fetchWebhook(process.env.CHATBRIDGE_WEBHOOK_ID, process.env.CHATBRIDGE_WEBHOOK_TOKEN);

			this.webhook = chatBridgeWebhook;
		} catch (error) {
			if (error instanceof DiscordAPIError && error.method === 'get' && error.code === 0 && error.httpStatus === 404) this.client.config.set('CHATBRIDGE_WEBHOOK_DELETED', 'true');
			logger.error(`[CHATBRIDGE WEBHOOK]: ${error.name}: ${error.message}`);
		}
	}

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

	_loadEvents() {
		const eventFiles = getAllJsFiles(path.join(__dirname, 'events'));

		for (const file of eventFiles) {
			const event = require(file);
			const EVENT_NAME = path.basename(file, '.js');

			this.bot[EVENT_NAME === 'login' ? 'once' : 'on'](EVENT_NAME, event.bind(null, this.client, this.bot));

			delete require.cache[require.resolve(file)];
		}

		logger.debug(`[EVENTS]: ${eventFiles.length} event${eventFiles.length !== 1 ? 's' : ''} loaded`);
	}
}

module.exports = MinecraftChatBridge;
