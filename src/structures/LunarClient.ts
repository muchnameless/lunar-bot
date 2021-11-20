import { URL } from 'node:url';
import { Client, MessageEmbed, Formatters } from 'discord.js';
import { UserUtil } from '../util';
import { cache, imgur } from '../api';
import { hours, logger } from '../functions';
import { DatabaseManager } from './database/managers/DatabaseManager';
import { LogHandler } from './LogHandler';
import { CronJobManager } from './CronJobManager';
import { ChatBridgeManager } from './chat_bridge/ChatBridgeManager';
import { ApplicationCommandCollection } from './commands/ApplicationCommandCollection';
import { EventCollection } from './events/EventCollection';
import type { ActivitiesOptions, ClientOptions, MessageOptions, Snowflake } from 'discord.js';
import type { db } from './database';

interface LunarClientOptions extends ClientOptions {
	db: typeof db;
	fetchAllMembers?: boolean;
}

export class LunarClient extends Client {
	ownerId: Snowflake;
	db: DatabaseManager;
	logHandler = new LogHandler(this, new URL('../../log_buffer', import.meta.url));
	cronJobs = new CronJobManager(this);
	chatBridges = new ChatBridgeManager(this);
	commands = new ApplicationCommandCollection(this, new URL('../commands', import.meta.url));
	events = new EventCollection(this, new URL('../events', import.meta.url));
	declare options: LunarClientOptions;
	log = this.logHandler.log.bind(this.logHandler);

	constructor(options: LunarClientOptions) {
		super(options);

		this.ownerId = process.env.OWNER as Snowflake;
		this.db = new DatabaseManager(this, options.db);
	}

	get config() {
		return this.db.modelManagers.config;
	}

	get hypixelGuilds() {
		return this.db.modelManagers.hypixelGuilds;
	}

	get players() {
		return this.db.modelManagers.players;
	}

	get taxCollectors() {
		return this.db.modelManagers.taxCollectors;
	}

	get chatTriggers() {
		return this.db.modelManagers.chatTriggers;
	}

	/**
	 * default embed, blue border and current timestamp
	 */
	get defaultEmbed() {
		return new MessageEmbed({
			color: this.config.get('EMBED_BLUE'),
			timestamp: Date.now(),
		});
	}

	/**
	 * fetches the bot application's owner
	 */
	fetchOwner() {
		return this.users.fetch(this.ownerId);
	}

	/**
	 * tag and @mention
	 */
	async fetchOwnerInfo() {
		try {
			const owner = await this.fetchOwner();
			return `${owner.tag} ${owner}`;
		} catch (error) {
			logger.error(error, '[OWNER INFO]');
			return Formatters.userMention(this.ownerId);
		}
	}

	/**
	 * loads all commands, events, db caches and logs the client in
	 * @param token discord bot token
	 */
	override async login(token?: string) {
		try {
			// load db caches
			await this.db.init();

			// these need the db cache to be populated
			await Promise.all([this.commands.loadAll(), this.events.loadAll(), this.chatBridges.loadChannelIds()]);

			// login
			const res = await super.login(token);

			// set presence again every 1h cause it get's lost sometimes
			setInterval(
				() =>
					this.isReady() &&
					this.user.setPresence({
						status: this.user.presence.status !== 'offline' ? this.user.presence.status : undefined,
						activities: this.user.presence.activities as ActivitiesOptions[],
					}),
				hours(1),
			);

			return res;
		} catch (error) {
			logger.error(error, '[CLIENT LOGIN]');
			return this.exit(1);
		}
	}

	/**
	 * sends a DM to the bot owner
	 * @param options
	 */
	async dmOwner(options: string | MessageOptions) {
		return UserUtil.sendDM(await this.fetchOwner(), options);
	}

	/**
	 * space-padding at the beginning and '0'-padding at the end
	 * @param number number to format
	 * @param paddingAmount amount to space-pad at the start
	 */
	formatDecimalNumber(number: number, paddingAmount = 0) {
		if (Number.isNaN(number)) return 'NaN'.padStart(paddingAmount, ' ');

		const [BEFORE_DOT, AFTER_DOT] = number.toFixed(2).split('.');

		return `${Number(BEFORE_DOT)
			.toLocaleString(this.config.get('NUMBER_FORMAT'))
			.padStart(paddingAmount, ' ')}.${AFTER_DOT}`;
	}

	/**
	 * space-padding at the beginning, converterFunction and locale string formatting
	 * @param number number to format
	 * @param paddingAmount amount to space-pad at the start (default 0)
	 * @param converterFunction function to be called on the number
	 */
	formatNumber(number: number, paddingAmount = 0, converterFunction: (input: number) => number = (x) => x) {
		return converterFunction(number)
			.toLocaleString(this.config.get('NUMBER_FORMAT'))
			.replace(',', '.')
			.padStart(paddingAmount, ' ');
	}

	/**
	 * closes all db connections and exits the process
	 * @param code exit code
	 */
	async exit(code = 0): Promise<never> {
		let hasError = false;

		try {
			await imgur.cacheRateLimits();
		} catch (error) {
			logger.fatal(error);
		}

		for (const output of await Promise.allSettled([
			this.db.sequelize.close(),
			// @ts-expect-error
			cache.opts.store?.redis?.quit(),
		])) {
			if (output.status === 'rejected') {
				logger.fatal(output.reason);
				hasError = true;
			} else if (typeof output.value !== 'undefined') {
				logger.info(output.value);
			}
		}

		process.exit(hasError ? 1 : code);
	}
}
