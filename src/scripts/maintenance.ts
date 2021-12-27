import { setInterval } from 'node:timers';
import process from 'node:process';
import { Client, Intents, SnowflakeUtil, Options, Constants, Sweepers } from 'discord.js';
import { InteractionUtil } from '../util';
import { db } from '../structures/database';
import { hours, logger } from '../functions';
import type { ActivitiesOptions, AnyChannel, ThreadChannel } from 'discord.js';

// catch rejections
process
	.on('unhandledRejection', (error) => {
		logger.error(error, '[UNCAUGHT PROMISE REJECTION]');
	})
	.on('uncaughtException', (error) => {
		logger.fatal(error, '[UNCAUGHT EXCEPTION]');
		process.exit(-1);
	});

// eslint-disable-next-line unicorn/prefer-top-level-await
db.sequelize.close().catch((error) => logger.error(error));

const presence = {
	activities: [
		{
			name: 'nothing due to maintenance',
			type: Constants.ActivityTypes.LISTENING,
		} as const,
	],
	status: 'dnd' as const,
};
const client = new Client({
	makeCache: Options.cacheWithLimits({
		...Options.defaultMakeCacheSettings,
		// @ts-expect-error
		ChannelManager: {
			sweepInterval: 3_600, // 1h
			sweepFilter: Sweepers.filterByLifetime({
				lifetime: 14_400, // 4h
				getComparisonTimestamp(e: AnyChannel) {
					if (e.type === 'DM') {
						// DM -> last message
						return e.lastMessageId ? SnowflakeUtil.timestampFrom(e.lastMessageId!) : -1;
					}
					return (e as ThreadChannel).archiveTimestamp ?? -1; // threads -> archived
				},
				excludeFromSweep: (e) => e.type !== 'DM' && !(e as ThreadChannel).archived,
			}),
		},
		GuildMemberManager: {
			maxSize: 1,
			keepOverLimit: (e) => e.id === e.client.user!.id,
		},
		MessageManager: 0,
		PresenceManager: 0,
		ReactionUserManager: {
			maxSize: 1,
			keepOverLimit: (e) => e.id === e.client.user!.id,
		},
		StageInstanceManager: 0,
		UserManager: {
			maxSize: 1,
			keepOverLimit: (e) => e.id === e.client.user!.id,
		},
		VoiceStateManager: 0,
	}),
	allowedMentions: { parse: [], repliedUser: true },
	partials: [
		Constants.PartialTypes.CHANNEL,
		// Constants.PartialTypes.GUILD_MEMBER,
		// Constants.PartialTypes.MESSAGE,
		// Constants.PartialTypes.REACTION,
		// Constants.PartialTypes.USER,
	],
	restGlobalRateLimit: 50,
	failIfNotExists: false,
	presence,
	intents: [
		// Intents.FLAGS.DIRECT_MESSAGES,
		// Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
		// Intents.FLAGS.DIRECT_MESSAGE_TYPING,
		Intents.FLAGS.GUILDS,
		// Intents.FLAGS.GUILD_BANS,
		// Intents.FLAGS.GUILD_EMOJIS_AND_STICKERS,
		// Intents.FLAGS.GUILD_INTEGRATIONS,
		// Intents.FLAGS.GUILD_INVITES,
		// Intents.FLAGS.GUILD_MEMBERS,
		// Intents.FLAGS.GUILD_MESSAGES,
		// Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
		// Intents.FLAGS.GUILD_MESSAGE_TYPING,
		// Intents.FLAGS.GUILD_PRESENCES,
		// Intents.FLAGS.GUILD_VOICE_STATES,
		// Intents.FLAGS.GUILD_WEBHOOKS,
	],
});

client
	.once(Constants.Events.CLIENT_READY, () => {
		// set presence again every 1h cause it get's lost sometimes
		setInterval(
			() =>
				client.isReady() &&
				client.user.setPresence({
					status: client.user.presence.status !== 'offline' ? client.user.presence.status : undefined,
					activities: client.user.presence.activities as ActivitiesOptions[],
				}),
			hours(1),
		);

		// log
		logger.info(`Startup complete. Logged in as ${client.user!.tag}`);
	})
	.on(Constants.Events.INTERACTION_CREATE, async (interaction) => {
		if (interaction.isAutocomplete()) {
			try {
				return await interaction.respond([]);
			} catch (error) {
				logger.error(error);
			}
		}

		if (!interaction.isApplicationCommand() && !interaction.isMessageComponent()) {
			return;
		}

		logger.info(InteractionUtil.logInfo(interaction), '[INTERACTION CREATE]: maintenance');

		InteractionUtil.reply(interaction, `${client.user} is currently unavailable due to maintenance`);
	})
	.login();
