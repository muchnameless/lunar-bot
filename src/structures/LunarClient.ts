import { setInterval } from 'node:timers';
import { URL } from 'node:url';
import { env } from 'node:process';
import { Client, EmbedBuilder } from 'discord.js';
import { PresenceUpdateStatus } from 'discord-api-types/v10';
import { GuildUtil, UserUtil } from '../util';
import { hours, safePromiseAll } from '../functions';
import { exitProcess } from '../process';
import { logger } from '../logger';
import { DatabaseManager } from './database/managers/DatabaseManager';
import { LogHandler } from './LogHandler';
import { CronJobManager } from './CronJobManager';
import { ChatBridgeManager } from './chat_bridge/ChatBridgeManager';
import { ApplicationCommandCollection } from './commands/ApplicationCommandCollection';
import { EventCollection } from './events/EventCollection';
import { db } from './database';
import type { ActivitiesOptions, ClientOptions, MessageOptions, Snowflake } from 'discord.js';

export class LunarClient<Ready extends boolean = boolean> extends Client<Ready> {
	override ownerId: Snowflake;
	override db: DatabaseManager = new DatabaseManager(this, db);
	override logHandler: LogHandler = new LogHandler(this, new URL('../../log_buffer/', import.meta.url));
	override cronJobs: CronJobManager = new CronJobManager(this);
	override chatBridges: ChatBridgeManager = new ChatBridgeManager(this);
	override commands: ApplicationCommandCollection = new ApplicationCommandCollection(
		this,
		new URL('../commands/', import.meta.url),
	);
	override events = new EventCollection(this, new URL('../events/', import.meta.url));
	override log = this.logHandler.log.bind(this.logHandler);

	constructor(options: ClientOptions) {
		super(options);

		this.ownerId = env.OWNER as Snowflake;
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
