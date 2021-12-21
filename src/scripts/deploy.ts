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

	logger.info(`[DEPLY]: started refreshing slash commands for ${GUILD_ID ? `guild ${GUILD_ID}` : 'the application'}`);

	const SHOULD_DELETE = process.argv.includes('delete') || process.argv.includes('d');

	const apiCommands = (await rest.put(
		GUILD_ID
			? Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID!, GUILD_ID)
			: Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
		{
			body: SHOULD_DELETE ? [] : client.commands.map(({ data }, name) => ({ ...data, name })),
		},
	)) as RESTPutAPIApplicationCommandsResult;

	if (!SHOULD_DELETE) {
		logger.info(
			`[DEPLY]: started setting permissions for ${GUILD_ID ? `guild ${GUILD_ID}` : 'the application'}'s slash commands`,
		);

		await Promise.all(
			client.hypixelGuilds.uniqueDiscordGuildIds.map((discordId) => {
				const fullPermissions: RESTPutAPIGuildApplicationCommandsPermissionsJSONBody = [];

				for (const { name, id } of apiCommands) {
					const command = client.commands.get(name);

					if (!command) {
						logger.warn(`unknown application command '${name}'`);
						continue;
					}

					const permissions = command.permissionsFor(discordId);

					if (!permissions.length) {
						logger.info(`no permissions to set for '${name}'`);
						continue;
					}

					fullPermissions.push({
						id,
						permissions,
					});
				}

				return rest.put(Routes.guildApplicationCommandsPermissions(process.env.DISCORD_CLIENT_ID!, discordId), {
					body: fullPermissions,
				});
			}),
		);
	}

	logger.info(`[DEPLY]: sucessfully ${SHOULD_DELETE ? 'deleted' : 'reloaded'} slash commands`);
} catch (error) {
	logger.error(error, '[DEPLOY]');
}

client.destroy();
process.exit(0);
