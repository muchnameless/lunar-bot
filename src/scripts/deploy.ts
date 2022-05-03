import { argv, env, exit } from 'node:process';
import { Routes } from 'discord-api-types/v10';
import { LunarClient } from '../structures/LunarClient';
import { logger } from '../logger';

const GUILD_ID = argv[2];
const client = new LunarClient({
	intents: 0,
});

client.rest.setToken(env.DISCORD_TOKEN!);

try {
	logger.info('[DEPLOY]: initialising database');

	await client.db.init();

	logger.info('[DEPLOY]: loading command cache');

	await client.commands.loadAll();

	const SHOULD_DELETE = argv.includes('delete') || argv.includes('d');
	const commands = SHOULD_DELETE ? [] : client.commands.apiData;

	logger.info(`[DEPLOY]: started refreshing slash commands for ${GUILD_ID ? `guild ${GUILD_ID}` : 'the application'}`);

	await client.rest.put(
		GUILD_ID
			? Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID!, GUILD_ID)
			: Routes.applicationCommands(env.DISCORD_CLIENT_ID!),
		{
			body: commands,
		},
	);

	logger.info(`[DEPLOY]: sucessfully ${SHOULD_DELETE ? 'deleted' : 'reloaded'} slash commands`);
} catch (error) {
	logger.error(error, '[DEPLOY]');
}

client.destroy();
exit(0);
