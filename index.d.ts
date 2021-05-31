declare module 'discord.js' {
	interface Message {
		client: import('./src/structures/LunarClient');
		// author: import('./src/structures/extensions/User');
	}

	interface CommandInteraction {
		client: import('./src/structures/LunarClient');
	}

	interface User {
		client: import('./src/structures/LunarClient');
		player: import('./src/structures/database/models/Player');
	}

	interface Channel {
		botPermissions: import('discord.js').Permissions
	}

	interface Guild {
		client: import('./src/structures/LunarClient');
	}

	interface GuildMember {
		client: import('./src/structures/LunarClient');
		player: import('./src/structures/database/models/Player');
		// user: import('./src/structures/extensions/User');
	}

	interface Base {
		// client: import('./src/structures/LunarClient');
	}

	interface MessageEmbed {
		padFields(numberOfRows?: number): this;
	}
}
