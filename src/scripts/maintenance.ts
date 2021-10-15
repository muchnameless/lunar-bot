import {
	Client,
	Intents,
	LimitedCollection,
	SnowflakeUtil,
	Options,
	Constants,
} from 'discord.js';
import { InteractionUtil } from '../util';
import { db } from '../structures/database';
import { logger } from '../functions';
import type {
	ActivitiesOptions,
	Channel,
	DMChannel,
	GuildMember,
	ThreadChannel,
} from 'discord.js';


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
db.sequelize.close().catch(error => logger.error(error));

const presence = {
	activities: [ {
		name: 'nothing due to maintenance',
		type: Constants.ActivityTypes.LISTENING,
	} as const ],
	status: 'dnd' as const,
};
const client = new Client({
	makeCache: Options.cacheWithLimits({
		...Options.defaultMakeCacheSettings,
		// @ts-expect-error
		ChannelManager: {
			sweepInterval: 3_600, // 1h
			sweepFilter: LimitedCollection.filterByLifetime({
				lifetime: 14_400, // 4h
				getComparisonTimestamp(e: Channel) {
					if (e.type === 'DM') { // DM -> last message
						return (e as DMChannel).lastMessageId
							? SnowflakeUtil.deconstruct((e as DMChannel).lastMessageId!).timestamp
							: -1;
					}
					return (e as ThreadChannel).archiveTimestamp ?? -1; // threads -> archived
				},
				excludeFromSweep: e => e.type !== 'DM' && !(e as ThreadChannel).archived,
			}),
		},
		GuildMemberManager: {
			maxSize: 1,
			keepOverLimit: e => e.id === e.client.user!.id,
		},
		MessageManager: 0,
		PresenceManager: 0,
		ReactionUserManager: {
			maxSize: 1,
			keepOverLimit: e => e.id === e.client.user!.id,
		},
		StageInstanceManager: 0,
		UserManager: {
			maxSize: 1,
			keepOverLimit: e => e.id === e.client.user!.id,
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
	failIfNotExists: false,
	presence,
	intents: [
		Intents.FLAGS.DIRECT_MESSAGES,
		// Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
		// Intents.FLAGS.DIRECT_MESSAGE_TYPING,
		Intents.FLAGS.GUILDS,
		// Intents.FLAGS.GUILD_BANS,
		// Intents.FLAGS.GUILD_EMOJIS_AND_STICKERS,
		// Intents.FLAGS.GUILD_INTEGRATIONS,
		// Intents.FLAGS.GUILD_INVITES,
		// Intents.FLAGS.GUILD_MEMBERS,
		Intents.FLAGS.GUILD_MESSAGES,
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
		setInterval(() => client.isReady() && client.user.setPresence({
			status: client.user.presence.status !== 'offline'
				? client.user.presence.status
				: undefined,
			activities: client.user.presence.activities as ActivitiesOptions[],
		}), 60 * 60_000);

		// log
		logger.info(`Startup complete. Logged in as ${client.user!.tag}`);
	})
	.on(Constants.Events.INTERACTION_CREATE, async (interaction) => {
		if (!interaction.isApplicationCommand() && !interaction.isMessageComponent()) return;

		logger.info(`${interaction.user.tag}${interaction.guildId ? ` | ${(interaction.member as GuildMember).displayName}` : ''} tried to execute '${InteractionUtil.logInfo(interaction)}' during maintenance`);

		try {
			await interaction.reply({
				content: `${client.user} is currently unavailable due to maintenance`,
				ephemeral: true,
			});
		} catch (error) {
			logger.error(error);
		}
	})
	.login();
