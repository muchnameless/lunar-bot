declare module 'discord.js' {
	interface Message {
		author: import('./src/structures/extensions/User');
	}

	interface User {
		player: import('./src/structures/database/models/Player');
	}

	interface Channel {
		botPermissions: Permissions;
	}

	interface GuildMember {
		player: import('./src/structures/database/models/Player');
		user: import('./src/structures/extensions/User');
	}

	interface ThreadMember {
		player: import('./src/structures/database/models/Player');
		user: import('./src/structures/extensions/User');
	}

	interface Base {
		client: import('./src/structures/LunarClient');
	}

	interface MessageEmbed {
		padFields(numberOfRows?: number): this;
	}
}
