export class Message extends (await import('discord.js')).Message {
	author: import('./structures/extensions/User');
}

// declare module 'discord.js' {
// 	interface Message {
// 		author: import('./structures/extensions/User');
// 	}

// 	interface User {
// 		player: import('./structures/database/models/Player');
// 	}

// 	interface Channel {
// 		botPermissions: Permissions;
// 	}

// 	interface GuildMember {
// 		player: import('./structures/database/models/Player');
// 		user: import('./structures/extensions/User');
// 	}

// 	interface ThreadMember {
// 		player: import('./structures/database/models/Player');
// 		user: import('./structures/extensions/User');
// 	}

// 	interface Base {
// 		client: import('./structures/LunarClient');
// 	}

// 	interface MessageEmbed {
// 		padFields(numberOfRows?: number): this;
// 	}
// }

declare module 'minecraft-protocol' {
	interface Client {
		readonly client: import('./structures/LunarClient');
		chat(message: string): void
		quit(reason: string): void
		player: import('./structures/database/models/Player');
		readonly ign: string;
		ready: boolean;
		ended: boolean;
		incrementMaxListeners(): void
		decrementMaxListeners(): void
	}
}