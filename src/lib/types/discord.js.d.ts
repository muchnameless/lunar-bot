import type { Snowflake } from 'discord.js';
import type { ChatBridgeManager } from '#chatBridge/ChatBridgeManager';
import type { ApplicationCommandCollection } from '#structures/commands/ApplicationCommandCollection';
import type { CronJobManager } from '#structures/CronJobManager';
import type { ConfigManager } from '#structures/database/managers/ConfigManager';
import type { DatabaseManager } from '#structures/database/managers/DatabaseManager';
import type { HypixelGuildManager } from '#structures/database/managers/HypixelGuildManager';
import type { ModelManager } from '#structures/database/managers/ModelManager';
import type { PlayerManager } from '#structures/database/managers/PlayerManager';
import type { TaxCollectorManager } from '#structures/database/managers/TaxCollectorManager';
import type { ChatTrigger } from '#structures/database/models/ChatTrigger';
import type { DiscordGuild } from '#structures/database/models/DiscordGuild';
import type { EventCollection } from '#structures/events/EventCollection';
import type { LogHandler } from '#structures/LogHandler';

declare module 'discord.js' {
	interface Client {
		ownerId: Snowflake;
		db: DatabaseManager;
		logHandler: LogHandler;
		cronJobs: CronJobManager;
		chatBridges: ChatBridgeManager;
		commands: ApplicationCommandCollection;
		events: EventCollection;
		log: LogHandler['log'];

		config: ConfigManager;
		hypixelGuilds: HypixelGuildManager;
		discordGuilds: ModelManager<DiscordGuild>;
		players: PlayerManager;
		taxCollectors: TaxCollectorManager;
		chatTriggers: ModelManager<ChatTrigger>;

		defaultEmbed: EmbedBuilder;

		dmOwner(options: string | MessageOptions): Promise<Message<boolean> | null>;
		fetchAllMembers(): Promise<void>;
	}
}
