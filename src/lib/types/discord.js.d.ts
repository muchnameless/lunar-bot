import type { Snowflake } from 'discord.js';
import type { ChatBridgeManager } from '#chatBridge/ChatBridgeManager.js';
import type { ConfigManager } from '#db/managers/ConfigManager.js';
import type { DatabaseManager } from '#db/managers/DatabaseManager.js';
import type { HypixelGuildManager } from '#db/managers/HypixelGuildManager.js';
import type { ModelManager } from '#db/managers/ModelManager.js';
import type { PlayerManager } from '#db/managers/PlayerManager.js';
import type { TaxCollectorManager } from '#db/managers/TaxCollectorManager.js';
import type { ChatTrigger } from '#db/models/ChatTrigger.js';
import type { DiscordGuild } from '#db/models/DiscordGuild.js';
import type { CronJobManager } from '#structures/CronJobManager.js';
import type { LogHandler } from '#structures/LogHandler.js';
import type { ApplicationCommandCollection } from '#structures/commands/ApplicationCommandCollection.js';
import type { PermissionsManager } from '#structures/commands/PermissionsManager.js';
import type { EventCollection } from '#structures/events/EventCollection.js';

declare module 'discord.js' {
	interface Client {
		readonly chatBridges: ChatBridgeManager;
		readonly chatTriggers: ModelManager<ChatTrigger>;
		readonly commands: ApplicationCommandCollection;
		readonly config: ConfigManager;
		readonly cronJobs: CronJobManager;
		readonly db: DatabaseManager;
		readonly defaultEmbed: EmbedBuilder;
		readonly discordGuilds: ModelManager<DiscordGuild>;
		dmOwner(options: MessageCreateOptions | string): Promise<Message<boolean> | null>;

		readonly events: EventCollection;
		fetchAllMembers(): Promise<void>;
		readonly hypixelGuilds: HypixelGuildManager;
		readonly log: LogHandler['log'];
		readonly logHandler: LogHandler;
		readonly ownerId: Snowflake;

		readonly permissions: PermissionsManager;

		readonly players: PlayerManager;
		readonly taxCollectors: TaxCollectorManager;
	}
}
