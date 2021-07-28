'use strict';

const { join } = require('path');
require('dotenv').config({ path: join(__dirname, '.env') });
const { REST } = require('@discordjs/rest');
const { Routes, APIVersion } = require('discord-api-types/v9');
const db = require('./structures/database/index');
const Client = require('./structures/LunarClient');
const logger = require('./functions/logger');


(async () => {
	const rest = new REST({ version: APIVersion }).setToken(process.env.DISCORD_TOKEN);
	const [ , , GUILD_ID ] = process.argv;
	const client = new Client({
		db,
		intents: 0,
	});

	try {
		logger.info('[DEPLOY]: initialising database');

		await client.db.init();

		logger.info('[DEPLOY]: loading command cache');

		await client.commands.loadAll();

		logger.info(`[DEPLY]: started refreshing application (/) commands for ${GUILD_ID ? `guild ${GUILD_ID}` : 'the application'}`);

		const SHOULD_DELETE = process.argv.includes('delete') || process.argv.includes('d');

		await rest.put(
			GUILD_ID
				? Routes.applicationGuildCommands(process.env.CLIENT_ID, GUILD_ID)
				: Routes.applicationCommands(process.env.CLIENT_ID),
			{
				body: SHOULD_DELETE
					? []
					: client.commands.map(({ data }, name) => ({ ...data, name })),
			},
		);

		logger.info(`[DEPLY]: sucessfully ${SHOULD_DELETE ? 'deleted' : 'reloaded'} application (/) commands`);
	} catch (error) {
		logger.error('[DEPLOY]', error);
	}

	client.destroy();
	process.exit(0);
})();
