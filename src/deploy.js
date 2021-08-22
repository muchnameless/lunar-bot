import { config } from 'dotenv';
import { fileURLToPath } from 'url';
config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
import { REST } from '@discordjs/rest';
import { Routes, APIVersion } from 'discord-api-types/v9';
import { db } from './structures/database/index.js';
import { LunarClient } from './structures/LunarClient.js';
import { logger } from './functions/index.js';


const rest = new REST({ version: APIVersion }).setToken(process.env.DISCORD_TOKEN);
const [ , , GUILD_ID ] = process.argv;
const client = new LunarClient({
	db,
	intents: 0,
});

try {
	logger.info('[DEPLOY]: initialising database');

	await client.db.init();

	logger.info('[DEPLOY]: loading command cache');

	await client.commands.loadAll();

	logger.info(`[DEPLY]: started refreshing slash commands for ${GUILD_ID ? `guild ${GUILD_ID}` : 'the application'}`);

	const SHOULD_DELETE = process.argv.includes('delete') || process.argv.includes('d');

	await rest.put(
		GUILD_ID
			? Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, GUILD_ID)
			: Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
		{
			body: SHOULD_DELETE
				? []
				: client.commands.map(({ data }, name) => ({ ...data, name })),
		},
	);

	if (!SHOULD_DELETE) {
		logger.info(`[DEPLY]: started setting permissions for ${GUILD_ID ? `guild ${GUILD_ID}` : 'the application'}'s slash commands`);

		await rest.put(
			Routes.guildApplicationCommandsPermissions(process.env.DISCORD_CLIENT_ID, GUILD_ID ?? client.config.get('DISCORD_GUILD_ID')),
			{
				body: client.commands.map(({ permissions }) => permissions).filter(({ permissions }) => permissions?.length),
			},
		);
	}

	logger.info(`[DEPLY]: sucessfully ${SHOULD_DELETE ? 'deleted' : 'reloaded'} slash commands`);
} catch (error) {
	logger.error('[DEPLOY]', error);
}

client.destroy();
process.exit(0);
