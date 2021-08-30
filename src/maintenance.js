import { config } from 'dotenv';
import { fileURLToPath } from 'url';
config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
import { Client, Intents, Permissions, LimitedCollection, SnowflakeUtil, Options, Constants } from 'discord.js';
import { ChannelUtil, MessageUtil } from './util/index.js';
import { db } from './structures/database/index.js';
import { escapeRegex, logger } from './functions/index.js';


// catch rejections
process
	.on('unhandledRejection', (error) => {
		logger.error('[UNCAUGHT PROMISE REJECTION]', error);
	})
	.on('uncaughtException', (error) => {
		logger.error('[UNCAUGHT EXCEPTION]', error);
		process.exit(1);
	});


// init
const PREFIX = (await db.Config.findOne({
	where: {
		key: 'PREFIXES',
	},
}))?.parsedValue[0] ?? 'lg!';

db.sequelize.close().catch(logger.error);

const presence = {
	activities: [{
		name: 'nothing due to maintenance',
		type: Constants.ActivityTypes.LISTENING,
	}],
	status: 'dnd',
};
const client = new Client({
	makeCache: Options.cacheWithLimits({
		...Options.defaultMakeCacheSettings,
		ChannelManager: {
			sweepInterval: 3_600,
			sweepFilter: LimitedCollection.filterByLifetime({
				lifetime: 14_400,
				getComparisonTimestamp: e => (e.type === 'DM'
					? (e.lastMessageId ? SnowflakeUtil.deconstruct(e.lastMessageId).timestamp : -1) // DM -> last message
					: e.archiveTimestamp), // threads -> archived
				excludeFromSweep: e => e.type !== 'DM' && !e.archived,
			}),
		},
		GuildMemberManager: {
			maxSize: 1,
			keepOverLimit: e => e.id === e.client.user.id,
		},
		MessageManager: 0,
		PresenceManager: 0,
		ReactionUserManager: {
			maxSize: 1,
			keepOverLimit: e => e.id === e.client.user.id,
		},
		StageInstanceManager: 0,
		UserManager: {
			maxSize: 1,
			keepOverLimit: e => e.id === e.client.user.id,
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

let prefixRegExp;

client
	.once(Constants.Events.CLIENT_READY, () => {
		prefixRegExp = new RegExp(`^(?:${[ escapeRegex(PREFIX), `<@!?${client.user.id}>` ].filter(Boolean).join('|')})`, 'i');

		setInterval(() => client.user.setPresence(presence), 60 * 60_000); // 1h

		// log
		logger.info(`Startup complete. Logged in as ${client.user.tag}`);
	})
	.on(Constants.Events.MESSAGE_CREATE, async (message) => {
		if (!MessageUtil.isUserMessage(message)) return;
		if (message.guildId && !prefixRegExp.test(message.content)) return; // allow PREFIX and @bot.id

		logger.info(`${message.author.tag}${message.member ? ` | ${message.member.displayName}` : ''} tried to execute '${message.content}' during maintenance`);

		// permissions check
		if (!ChannelUtil.botPermissions(message.channel)?.has([ Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES ])) return;

		try {
			await message.reply(`${client.user} is currently unavailable due to maintenance`);
		} catch (error) {
			logger.error(error);

			// update roles for the client member if error is related to (outdated) permissions
			if ([ Constants.APIErrors.MISSING_PERMISSIONS, Constants.APIErrors.MISSING_ACCESS ].includes(error.code)) {
				try {
					await message.guild?.me.fetch(true);
				} catch (err) {
					logger.error(err);
				}
			}
		}
	})
	.on(Constants.Events.INTERACTION_CREATE, async (interaction) => {
		if (!interaction.isCommand() && !interaction.isMessageComponent()) return;

		logger.info(`${interaction.user.tag}${interaction.guildId ? ` | ${interaction.member.displayName}` : ''} tried to execute '${interaction.commandName ?? interaction.customId}' during maintenance`);

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
