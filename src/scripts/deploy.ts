import process from 'node:process';
import { REST } from '@discordjs/rest';
import { Routes, APIVersion } from 'discord-api-types/v9';
import { db } from '../structures/database';
import { LunarClient } from '../structures/LunarClient';
import { logger } from '../functions';
import type {
	RESTPutAPIApplicationCommandsResult,
	RESTPutAPIGuildApplicationCommandsPermissionsJSONBody,
} from 'discord-api-types/v9';

const rest = new REST({ version: APIVersion }).setToken(process.env.DISCORD_TOKEN!);
const [, , GUILD_ID] = process.argv;
const client = new LunarClient({
	db,
	intents: 0,
});

try {
	logger.info('[DEPLOY]: initialising database');

	await client.db.init();

	logger.info('[DEPLOY]: loading command cache');

	await client.commands.loadAll();

	const SHOULD_DELETE = process.argv.includes('delete') || process.argv.includes('d');
	const commands = SHOULD_DELETE ? [] : [...new Set(client.commands.values())].flatMap(({ data }) => data);

	logger.info(`[DEPLOY]: started refreshing slash commands for ${GUILD_ID ? `guild ${GUILD_ID}` : 'the application'}`);

	const apiCommands = (await rest.put(
		GUILD_ID
			? Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID!, GUILD_ID)
			: Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
		{
			body: commands,
		},
	)) as RESTPutAPIApplicationCommandsResult;

	if (!SHOULD_DELETE) {
		const guildIds = GUILD_ID ? [GUILD_ID] : client.hypixelGuilds.uniqueDiscordGuildIds;

		logger.info("[DEPLOY]: started setting permissions for the application's slash commands");

		await Promise.all(
			guildIds.map(async (guildId) => {
				const fullPermissions: RESTPutAPIGuildApplicationCommandsPermissionsJSONBody = [];

				for (const { name, id } of apiCommands) {
					const command = client.commands.get(name);

					if (!command) {
						logger.error(`[DEPLOY]: unknown application command '${name}'`);
						continue;
					}

					const permissions = command.permissionsFor(guildId);

					if (!permissions.length) {
						logger.trace(`[DEPLOY]: no permissions to set for '${name}'`);
						continue;
					}

					fullPermissions.push({
						id,
						permissions,
					});
				}

				logger.info(`[DEPLOY]: setting permissions for '${guildId}'`);

				await rest.put(Routes.guildApplicationCommandsPermissions(process.env.DISCORD_CLIENT_ID!, guildId), {
					body: fullPermissions,
				});

				logger.info(`[DEPLOY]: successfully set permissions for '${guildId}'`);
			}),
		);
	}

	logger.info(`[DEPLOY]: sucessfully ${SHOULD_DELETE ? 'deleted' : 'reloaded'} slash commands`);
} catch (error) {
	logger.error(error, '[DEPLOY]');
}

client.destroy();
process.exit(0);
