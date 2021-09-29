import type { LunarClient } from '../structures/LunarClient';
import type { Merge } from './util';

// import type { Collection, Snowflake } from 'discord.js';
// import type { DatabaseManager } from '../structures/database/managers/DatabaseManager';

// declare module "discord.js" {
//     interface Client {
// 		ownerId: Snowflake;
// 		db: DatabaseManager;
// 		logHandler: LogHandler;
// 		cronJobs: CronJobManager;
// 		chatBridges: ChatBridgeArray;
// 		commands: SlashCommandCollection;
// 		events: EventCollection;
//     }
// }


declare module 'discord.js' {
	// Client = Merge<Client<true>, LunarClient>;
	// interface Client extends Merge<Client<true>, LunarClient> {};
	// interface Interaction {
	// 	client: LunarClient;
	// }
	class Client<Ready extends boolean = true> extends LunarClient {};
}
