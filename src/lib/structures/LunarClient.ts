import { setInterval } from 'node:timers';
import { env } from 'node:process';
import { Client, EmbedBuilder, PresenceUpdateStatus } from 'discord.js';
import { GuildUtil, UserUtil } from '#utils';
import { logger } from '#logger';
import { hours, safePromiseAll } from '#functions';
import { ChatBridgeManager } from '#chatBridge/ChatBridgeManager';
import { exitProcess } from '../../process';
import { DatabaseManager } from './database/managers/DatabaseManager';
import { LogHandler } from './LogHandler';
import { CronJobManager } from './CronJobManager';
import { ApplicationCommandCollection } from './commands/ApplicationCommandCollection';
import { PermissionsManager } from './commands/PermissionsManager';
import { EventCollection } from './events/EventCollection';
import { db } from './database';
import type { URL } from 'node:url';
import type { ActivitiesOptions, ClientOptions, MessageOptions, Snowflake } from 'discord.js';

interface DirURLs {
	applicationCommands: URL;
	chatBridgeCommands: URL;
	events: URL;
	logBuffer: URL;
}

export class LunarClient<Ready extends boolean = boolean> extends Client<Ready> {
	override ownerId: Snowflake;
	override db: DatabaseManager = new DatabaseManager(this, db);
	override logHandler: LogHandler;
	override cronJobs: CronJobManager = new CronJobManager(this);
	override permissions: PermissionsManager = new PermissionsManager(this);
	override chatBridges: ChatBridgeManager;
	override commands: ApplicationCommandCollection;
	override events: EventCollection;
	override log: LogHandler['log'];

	constructor({ applicationCommands, chatBridgeCommands, events, logBuffer, ...options }: ClientOptions & DirURLs) {
		super(options);

		this.ownerId = env.OWNER as Snowflake;
		this.commands = new ApplicationCommandCollection(this, applicationCommands);
		this.chatBridges = new ChatBridgeManager(this, chatBridgeCommands);
		this.events = new EventCollection(this, events);
		this.logHandler = new LogHandler(this, logBuffer);
		this.log = this.logHandler.log.bind(this.logHandler);
	}

	override get config() {
		return this.db.modelManagers.config;
	}

	override get hypixelGuilds() {
		return this.db.modelManagers.hypixelGuilds;
	}

	override get discordGuilds() {
		return this.db.modelManagers.discordGuilds;
	}

	override get players() {
		return this.db.modelManagers.players;
	}

	override get taxCollectors() {
		return this.db.modelManagers.taxCollectors;
	}

	override get chatTriggers() {
		return this.db.modelManagers.chatTriggers;
	}

	/**
	 * default embed, blue border and current timestamp
	 */
	override get defaultEmbed() {
		return new EmbedBuilder({
			color: this.config.get('EMBED_BLUE'),
			timestamp: Date.now(),
		});
	}

	/**
	 * loads all commands, events, db caches and logs the client in
	 * @param token discord bot token
	 */
	override async login(token?: string) {
		try {
			// load db caches
			await Promise.all([this.db.init(), this.commands.loadAll(), this.events.loadAll()]);

			// needs the db cache to be populated
			this.chatBridges.loadChannelIds();

			// login
			const res = await super.login(token);

			// set presence again every 1h cause it get's lost sometimes
			setInterval(
				() =>
					this.isReady() &&
					this.user.setPresence({
						status: this.user.presence.status !== PresenceUpdateStatus.Offline ? this.user.presence.status : undefined,
						activities: this.user.presence.activities as ActivitiesOptions[],
					}),
				hours(1),
			);

			return res;
		} catch (error) {
			logger.error(error, '[CLIENT LOGIN]');
			return exitProcess(1);
		}
	}

	/**
	 * sends a DM to the bot owner
	 * @param options
	 */
	override async dmOwner(options: string | MessageOptions) {
		try {
			return UserUtil.sendDM(await this.users.fetch(this.ownerId), options);
		} catch (error) {
			logger.error(error, '[DM OWNER]');
			return null;
		}
	}

	/**
	 * fetches and caches all members if the fetchAllMembers client option is set to true
	 */
	override fetchAllMembers() {
		return safePromiseAll(
			this.guilds.cache.map(async (guild) => {
				const { size } = await GuildUtil.fetchAllMembers(guild);
				logger.info(`[FETCH ALL MEMBERS]: ${guild.name}: fetched ${size} members`);
			}),
		);
	}
}
