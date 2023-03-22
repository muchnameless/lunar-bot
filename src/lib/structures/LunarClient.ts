import { env } from 'node:process';
import { setInterval } from 'node:timers';
import type { URL } from 'node:url';
import {
	Client,
	EmbedBuilder,
	PresenceUpdateStatus,
	type ActivitiesOptions,
	type ClientOptions,
	type MessageCreateOptions,
	type Snowflake,
} from 'discord.js';
import { ChatBridgeManager } from '#chatBridge/ChatBridgeManager.js';
import { db } from '#db';
import { DatabaseManager } from '#db/managers/DatabaseManager.js';
import { hours, safePromiseAll } from '#functions';
import { logger } from '#logger';
import { exitProcess } from '#root/process.js';
import { CronJobManager } from '#structures/CronJobManager.js';
import { LogHandler } from '#structures/LogHandler.js';
import { ApplicationCommandCollection } from '#structures/commands/ApplicationCommandCollection.js';
import { PermissionsManager } from '#structures/commands/PermissionsManager.js';
import type { DiscordJSEvent } from '#structures/events/DiscordJSEvent';
import { EventCollection } from '#structures/events/EventCollection.js';
import type { RESTEvent } from '#structures/events/RESTEvent';
import { GuildUtil, UserUtil } from '#utils';

interface DirURLs {
	applicationCommands: URL;
	chatBridgeCommands: URL;
	events: URL;
	logBuffer: URL;
}

export class LunarClient<Ready extends boolean = boolean> extends Client<Ready> {
	public override readonly ownerId: Snowflake;

	public override readonly db: DatabaseManager = new DatabaseManager(this, db);

	public override readonly logHandler: LogHandler;

	public override readonly cronJobs: CronJobManager = new CronJobManager(this);

	public override readonly permissions: PermissionsManager = new PermissionsManager(this);

	public override readonly chatBridges: ChatBridgeManager;

	public override readonly commands: ApplicationCommandCollection;

	public override readonly events: EventCollection<DiscordJSEvent | RESTEvent>;

	public override readonly log: LogHandler['log'];

	public constructor({
		applicationCommands,
		chatBridgeCommands,
		events,
		logBuffer,
		...options
	}: ClientOptions & DirURLs) {
		super(options);

		this.ownerId = env.OWNER as Snowflake;
		this.commands = new ApplicationCommandCollection(this, applicationCommands);
		this.chatBridges = new ChatBridgeManager(this, chatBridgeCommands);
		this.events = new EventCollection(this, events);
		this.logHandler = new LogHandler(this, logBuffer);
		this.log = this.logHandler.log.bind(this.logHandler);
	}

	public override get config() {
		return this.db.modelManagers.config;
	}

	public override get hypixelGuilds() {
		return this.db.modelManagers.hypixelGuilds;
	}

	public override get discordGuilds() {
		return this.db.modelManagers.discordGuilds;
	}

	public override get players() {
		return this.db.modelManagers.players;
	}

	public override get taxCollectors() {
		return this.db.modelManagers.taxCollectors;
	}

	public override get chatTriggers() {
		return this.db.modelManagers.chatTriggers;
	}

	/**
	 * default embed, blue border and current timestamp
	 */
	public override get defaultEmbed() {
		return new EmbedBuilder({
			color: this.config.get('EMBED_BLUE'),
			timestamp: Date.now(),
		});
	}

	/**
	 * loads all commands, events, db caches and logs the client in
	 *
	 * @param token - discord bot token
	 */
	public override async login(token?: string) {
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
						status: this.user.presence.status === PresenceUpdateStatus.Offline ? undefined : this.user.presence.status,
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
	 *
	 * @param options
	 */
	public override async dmOwner(options: MessageCreateOptions | string) {
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
	public override fetchAllMembers() {
		return safePromiseAll(
			this.guilds.cache.map(async (guild) => {
				await GuildUtil.fetchAllMembers(guild);
				logger.info(GuildUtil.logInfo(guild), '[FETCH ALL MEMBERS]');
			}),
		);
	}
}
