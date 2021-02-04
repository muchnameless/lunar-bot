'use strict';

const { Client, MessageEmbed, SnowflakeUtil, Constants } = require('discord.js');
const path = require('path');
const fs = require('fs');
const { cleanLoggingEmbedString } = require('../functions/util');
const { getAllJsFiles } = require('../functions/files');
const db = require('../../database/models/index');
const logger = require('../functions/logger');
const BannedUserCollection = require('./collections/BannedUserCollection');
const CommandCollection = require('./collections/CommandCollection');
const ConfigCollection = require('./collections/ConfigCollection');
const CooldownCollection = require('./collections/CooldownCollection');
const CronJobCollection = require('./collections/CronJobCollection');
const HypixelGuildCollection = require('./collections/HypixelGuildCollection');
const PlayerCollection = require('./collections/PlayerCollection');
const TaxCollectorCollection = require('./collections/TaxCollectorCollection');


class LunarClient extends Client {
	constructor(options = {}) {
		super(options);

		this.webhook = null;
		this.ownerID = process.env.OWNER ?? null;

		// custom collections
		this.bannedUsers = new BannedUserCollection(this);
		this.commands = new CommandCollection(this);
		this.config = new ConfigCollection(this);
		this.cooldowns = new CooldownCollection(this);
		this.cronJobs = new CronJobCollection(this);
		this.hypixelGuilds = new HypixelGuildCollection(this);
		this.players = new PlayerCollection(this);
		this.taxCollectors = new TaxCollectorCollection(this);

		for (const dbEntry of Object.values(db).filter(value => Object.getPrototypeOf(value) === db.Sequelize.Model)) {
			Object.defineProperties(dbEntry.prototype, {
				client: {
					value: this,
				},
				db: {
					value: db,
				},
			});
		}
	}

	/**
	 * returns the lunar guard discord guild
	 * @returns {Guild} lunar guard discord guild
	 */
	get lgGuild() {
		const lgGuild = this.guilds.cache.get(this.config.get('DISCORD_GUILD_ID'));
		return lgGuild?.available ? lgGuild : logger.warn('discord guild is currently unavailable');
	}

	/**
	 * returns the logging webhook's channel
	 */
	get loggingChannel() {
		return this.channels.cache.get(this.webhook?.channelID) ?? null;
	}

	/**
	 * loads all commands, events, db caches and logs the client in
	 * @param {string?} token discord bot token
	 */
	async login(token) {
		await this.loadDbCache();

		this.loadCommands();
		this._loadEvents();

		return super.login(token);
	}

	/**
	 * loads all dbs into their respective <LunarClient>.<Collection>
	 */
	async loadDbCache() {
		(await db.BannedUser.findAll())
			.forEach(user => this.bannedUsers.set(user.discordID, user));

		(await db.Config.findAll())
			.forEach(config => this.config._set(config.key, config));

		(await db.HypixelGuild.findAll())
			.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
			.forEach(hypixelGuild => this.hypixelGuilds.set(hypixelGuild.guildID, hypixelGuild));

		(await db.Player.findAll({
			where: {
				// player is in a guild that the bot tracks
				guildID: {
					[db.Sequelize.Op.ne]: null,
				},
			},
		}))
			.forEach(player => this.players.set(player.minecraftUUID, player));

		this.players.sortAlphabetically();

		(await db.TaxCollector.findAll())
			.forEach(taxCollector => this.taxCollectors.set(taxCollector.minecraftUUID, taxCollector));
	}

	/**
	 * loads a single command into the <LunarClient>.commands collection
	 * @param {string} file command file to load
	 */
	loadCommand(file) {
		const [, CATEGORY, COMMAND_NAME ] = file.match(/[/\\]commands[/\\](\D+)[/\\](\D+)\.js/);
		const commandConstructor = require(file);
		const command = new commandConstructor({
			client: this,
			name: COMMAND_NAME,
			category: CATEGORY,
		});

		this.commands.set(COMMAND_NAME.toLowerCase(), command);
	}

	/**
	 * loads all commands into the <LunarClient>.commands collection
	 */
	loadCommands() {
		const commandFiles = getAllJsFiles(path.join(__dirname, '..', 'commands'));

		if (!commandFiles) logger.warn('[COMMANDS]: no command files');

		for (const file of commandFiles) {
			this.loadCommand(file);
		}

		logger.debug(`[COMMANDS]: ${commandFiles.length} command${commandFiles.length !== 1 ? 's' : ''} loaded`);
	}

	/**
	 * loads all event-callbacks and binds them to their respective events
	 */
	_loadEvents() {
		const eventFiles = getAllJsFiles(path.join(__dirname, '..', 'events'));

		if (!eventFiles) return logger.warn('[EVENTS]: no event files');

		for (const file of eventFiles) {
			const event = require(file);
			const EVENT_NAME = path.basename(file, '.js');

			if (EVENT_NAME === Constants.Events.CLIENT_READY) {
				this.once(EVENT_NAME, event.bind(null, this));
			} else {
				this.on(EVENT_NAME, event.bind(null, this));
			}

			delete require.cache[require.resolve(file)];
		}

		logger.debug(`[EVENTS]: ${eventFiles.length} event${eventFiles.length !== 1 ? 's' : ''} loaded`);
	}

	/**
	 * logs the embeds to console and via the logging webhook
	 * @param {...MessageEmbed|string} embeds embeds to log
	 * @param {Promise<Message?>}
	 */
	async log(...embeds) {
		embeds = embeds.filter(x => x != null); // filter out null, undefined, ...

		if (!embeds.length) throw new TypeError('[CLIENT LOG]: cannot send an empty message');
		if (embeds.length > 10) throw new RangeError('[CLIENT LOG]: exceeded maximum embed count of 10');

		for (const embed of embeds) {
			if (typeof embed === 'string') {
				embeds[embeds.indexOf(embed)] = new MessageEmbed({ color: this.config.get('EMBED_BLUE'), description: embed });
			} else if (typeof embed !== 'object' || !embed) {
				throw new TypeError(`[CLIENT LOG]: provided argument '${embed}' is a ${typeof embed} instead of an Object or String`);
			}

			const FIELDS_LOG = embed.fields?.filter(field => field.name !== '\u200b' || field.value !== '\u200b');

			logger.info([
				[ embed.title, cleanLoggingEmbedString(embed.description), embed.author?.name ].filter(x => x != null).join(': '),
				FIELDS_LOG?.length ? FIELDS_LOG.map(field => `${field.name !== '\u200b' ? `${field.name.replace(/\u200b/g, '').trim()}: ` : ''}${cleanLoggingEmbedString(field.value).replace(/\n/g, ', ')}`).join('\n') : null,
			].filter(x => x != null).join('\n'));
		}

		if (!this.webhook) {
			logger.warn('[CLIENT LOG]: webhook unavailable');
			return this._logToFile(embeds.map(embed => JSON.stringify(embed)).join('\n'));
		}

		return this.webhook
			.send({
				username: `${this.user.username} Log`,
				avatarURL: this.user.displayAvatarURL(),
				embeds,
			})
			.catch(error => {
				logger.error(`[CLIENT LOG]: ${error.name}: ${error.message}`);
				this._logToFile(embeds.map(embed => JSON.stringify(embed)).join('\n'));
			});
	}

	/**
	 * write data in 'cwd/log_buffer'
	 * @param {*} data file content
	 */
	_logToFile(data) {
		fs.writeFile(
			path.join(__dirname, '..', '..', 'log_buffer', `${new Date().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}_${SnowflakeUtil.generate()}`),
			data,
			err => err && logger.info(err),
		);
	}

	/**
	 * read all files from 'cwd/log_buffer' and webhook log their parsed content
	 */
	postFileLogs() {
		const LOG_BUFFER_PATH = path.join(__dirname, '..', '..', 'log_buffer');
		const logBufferFiles = fs.readdirSync(LOG_BUFFER_PATH);

		if (!logBufferFiles) return;

		for (const file of logBufferFiles) {
			const FILE_PATH = path.join(LOG_BUFFER_PATH, file);

			this
				.log(...fs.readFileSync(FILE_PATH, 'utf8').split('\n').map(x => new MessageEmbed(JSON.parse(x))))
				.then(() => fs.unlinkSync(FILE_PATH));
		}
	}

	/**
	 * space-padding at the beginning and '0'-padding at the end
	 * @param {number} number number to format
	 * @param {number} paddingAmount amount to space-pad at the start (default 2)
	 */
	formatDecimalNumber(number, paddingAmount = 2) {
		const NUMBER_ARRAY = number.toFixed(2).split('.');
		return `${Number(NUMBER_ARRAY[0]).toLocaleString(this.config.get('NUMBER_FORMAT')).padStart(paddingAmount, ' ')}.${NUMBER_ARRAY[1]}`;
	}

	/**
	 * space-padding at the beginning, converterFunction and locale string formatting
	 * @param {number} number number to format
	 * @param {number} paddingAmount amount to space-pad at the start (default 0)
	 * @param {Function} converterFunction function to be called on the number
	 */
	formatNumber(number, paddingAmount = 0, converterFunction = x => x) {
		return converterFunction(number).toLocaleString(this.config.get('NUMBER_FORMAT')).padStart(paddingAmount, ' ');
	}
}

module.exports = LunarClient;
