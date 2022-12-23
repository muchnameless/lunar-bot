import { argv, env, exit } from 'node:process';
import { URL } from 'node:url';
import { Routes } from 'discord.js';
import { logger } from '#logger';
import { LunarClient } from '#structures/LunarClient.js';

const GUILD_ID = argv[2];
const client = new LunarClient({
	// custom
	applicationCommands: new URL('../commands', import.meta.url),
	chatBridgeCommands: new URL('../lib/chatBridge/commands', import.meta.url),
	events: new URL('../events', import.meta.url),
	logBuffer: new URL('../../log_buffer/', import.meta.url),

	// discord.js
	intents: 0,
});

client.rest.setToken(env.DISCORD_TOKEN);

try {
	logger.info('[DEPLOY]: initialising database');

	await client.db.init();

	logger.info('[DEPLOY]: loading command cache');

	await client.commands.loadAll();

	const SHOULD_DELETE = argv.includes('delete') || argv.includes('d');
	const commands = SHOULD_DELETE ? [] : client.commands.apiData;

	logger.info({ guildId: GUILD_ID }, '[DEPLOY]: started refreshing application commands');

	await client.rest.put(
		GUILD_ID
			? Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, GUILD_ID)
			: Routes.applicationCommands(env.DISCORD_CLIENT_ID),
		{
			body: commands,
		},
	);

	logger.info(`[DEPLOY]: successfully ${SHOULD_DELETE ? 'deleted' : 'reloaded'} slash commands`);
} catch (error) {
	logger.error(error, '[DEPLOY]');
}

client.destroy();
exit(0);
