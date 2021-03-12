'use strict';

const { DiscordAPIError, Constants } = require('discord.js');
const { stripIndents, oneLineCommaListsOr } = require('common-tags');
const { UNKNOWN_IGN } = require('../../constants/database');
const { checkIfDiscordTag, getHypixelClient } = require('../../functions/util');
const mojang = require('../../api/mojang');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class LinkCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'link a discord user to a minecraft ign',
			args: true,
			usage: '[`IGN`] [`discord id`|`discord tag`|`@mention`]',
			cooldown: 1,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(message, args, flags, rawArgs) {
		try {
			message.channel.startTyping();

			const { players, hypixelGuilds } = this.client;
			const [ unknownPlayerInGuild ] = (await Promise.all(
				(await Promise.all(
					args
						.filter(arg => /^\w+$/.test(arg))
						.map(async arg => mojang.getUUID(arg).catch(error => logger.error(`[LINK]: mojang with '${arg}': ${error.name} ${error.code}: ${error.message}`))),
				))
					.filter(uuid => uuid != null)
					.map(async uuid => ({
						uuid,
						hypixelGuild: await getHypixelClient(true).guild.player(uuid).catch(error => logger.error(`[LINK]: guild fetch: ${error.name}${error.code ? ` ${error.code}` : ''}: ${error.message}`)),
					})),
			)).filter(({ hypixelGuild }) => hypixelGuilds.cache.keyArray().includes(hypixelGuild?._id));
			/**
			 * @type {?import('../../structures/database/models/Player')}
			 */
			const player = unknownPlayerInGuild
				? await (async () => {
					// try to find player in the db
					let dbEntry = await players.model.findByPk(unknownPlayerInGuild.uuid).catch(error => logger.error(`[LINK]: ${error.name}: ${error.message}`));

					if (dbEntry) {
						dbEntry.guildID = unknownPlayerInGuild.hypixelGuild._id;
						return dbEntry.save();
					}

					// create new db entry
					const IGN = await mojang.getName(unknownPlayerInGuild.uuid).catch(error => logger.error(`[LINK]: mojang with '${unknownPlayerInGuild.uuid}': ${error.name} ${error.code}: ${error.message}`)) ?? UNKNOWN_IGN;

					dbEntry = await players.model
						.create({
							minecraftUUID: unknownPlayerInGuild.uuid,
							ign: IGN,
							guildID: unknownPlayerInGuild.hypixelGuild._id,
						})
						.catch(error => logger.error(`[LINK]: ${error.name}: ${error.message}`));

					if (!dbEntry) throw new Error(stripIndents`
						error while creating new db entry for ${IGN} (${unknownPlayerInGuild.uuid}).
						Wait for the next automatic database update (check ${this.client.loggingChannel ?? '#lunar-logs'})
					`);
				})()
				: (() => {
					const playerInput = args
						.map(arg => this.client.players.autocorrectToPlayer(arg))
						.sort((a, b) => a.similarity - b.similarity)
						.pop();

					return playerInput?.similarity >= this.client.config.get('AUTOCORRECT_THRESHOLD')
						? playerInput.value
						: null;
				})();

			// no player to link found
			if (!player) return message.reply(stripIndents`
				${oneLineCommaListsOr`${args.map(arg => `\`${arg}\``)}`} does not contain a known IGN.
				Make sure to provide the full ign if the player database is not already updated (check ${this.client.loggingChannel ?? '#lunar-logs'})
			`);

			// try to find the discord account to link the player to
			const DISCORD_ID = message.mentions.users.size
				? message.mentions.users.first().id
				: await (async () => {
					for (const tag of rawArgs.filter(checkIfDiscordTag)) {
						const res = await this.client.lgGuild?.findMemberByTag(tag);
						if (res) return res.id;
					}

					// try to fetch a discord user from all integer only args as IDs to determine if one arg is a discord user ID
					for (const number of args.filter(arg => /^\d+$/.test(arg))) {
						const res = await this.client.users.fetch(number).catch(() => null);
						if (res) return res.id;
					}
				})();

			// no discord account to link found
			if (!DISCORD_ID) return message.reply('either provide the user\'s discord id, tag or @mention them.');

			// discordID already linked to another player
			const playerLinkedToID = players.getByID(DISCORD_ID);

			if (playerLinkedToID) {
				let isDeleted = false;

				const linkedUser = await playerLinkedToID.discordUser.catch((error) => {
					if (error instanceof DiscordAPIError && error.code === Constants.APIErrors.UNKNOWN_USER) {
						isDeleted = true;
						return logger.error(`[LINK]: ${playerLinkedToID.logInfo}: deleted discord user: ${playerLinkedToID.discordID}`);
					}
					return logger.error(`[LINK]: ${playerLinkedToID.logInfo}: error fetching already linked user: ${error.name}: ${error.message}`);
				});

				if (!isDeleted) {
					if (!flags.some(flag => [ 'f', 'force' ].includes(flag))) {
						const ANSWER = await message.awaitReply(
							stripIndents`
								${linkedUser ?? `\`${DISCORD_ID}\``} is already linked to \`${playerLinkedToID.ign}\`. Overwrite this?
								Make sure to provide the full ign if the player database is not already updated (check ${this.client.loggingChannel ?? '#lunar-logs'})
							`,
							30,
							{ allowedMentions: { parse: [] } },
						);

						if (!this.client.config.getArray('REPLY_CONFIRMATION').includes(ANSWER?.toLowerCase())) return message.reply('the command has been cancelled.');
					}
				}

				if (!(await playerLinkedToID.unlink(`unlinked by ${message.author.tag}`)) && linkedUser) {
					await message.reply(
						`unable to update roles and nickname for the currently linked member ${linkedUser}.`,
						{ allowedMentions: { parse: [] }, saveReplyMessageID: false },
					);
				}
			}

			// player already linked
			if (/^\d+$/.test(player.discordID)) {
				let isDeleted = false;

				const linkedUser = await player.discordUser.catch((error) => {
					if (error instanceof DiscordAPIError && error.code === Constants.APIErrors.UNKNOWN_USER) {
						isDeleted = true;
						return logger.error(`[LINK]: ${player.logInfo}: deleted discord user: ${player.discordID}`);
					}
					return logger.error(`[LINK]: ${player.logInfo}: error fetching already linked user: ${error.name}: ${error.message}`);
				});

				if (!isDeleted) {
					if (player.discordID === DISCORD_ID) return message.reply(
						`\`${player.ign}\` is already linked to ${linkedUser ?? `\`${player.discordID}\``}.`,
						{ allowedMentions: { parse: [] } },
					);

					if (!flags.some(flag => [ 'f', 'force' ].includes(flag))) {
						const ANSWER = await message.awaitReply(
							stripIndents`
								\`${player.ign}\` is already linked to ${linkedUser ?? `\`${player.discordID}\``}. Overwrite this?
								Make sure to provide the full ign if the player database is not already updated (check ${this.client.loggingChannel ?? '#lunar-logs'})
							`,
							30,
							{ allowedMentions: { parse: [] } },
						);

						if (!this.client.config.getArray('REPLY_CONFIRMATION').includes(ANSWER?.toLowerCase())) return message.reply('the command has been cancelled.');
					}
				}

				if (!(await player.unlink(`unlinked by ${message.author.tag}`)) && linkedUser) {
					await message.reply(
						`unable to update roles and nickname for the currently linked member ${linkedUser}.`,
						{ allowedMentions: { parse: [] }, saveReplyMessageID: false },
					);
				}
			}

			// try to find the linked users member data
			const discordMember = message.mentions.members?.size
				? message.mentions.members.first()
				: await this.client.lgGuild?.members.fetch(DISCORD_ID).catch(error => logger.error(`[LINK]: error fetching member to link: ${error.name}: ${error.message}`));

			// no discord member for the user to link found
			if (!discordMember) {
				await player.link(DISCORD_ID);
				return message.reply(`\`${player.ign}\` linked to \`${DISCORD_ID}\` but could not be found on the Lunar Guard discord server.`);
			}

			// user to link is in discord -> update roles
			await player.link(discordMember, `linked by ${message.author.tag}`);

			let reply = `\`${player.ign}\` linked to ${discordMember}`;

			if (!discordMember.roles.cache.has(this.client.config.get('VERIFIED_ROLE_ID')))	{
				reply += ` (missing ${this.client.lgGuild?.roles.cache.get(this.client.config.get('VERIFIED_ROLE_ID'))?.name ?? this.client.config.get('VERIFIED_ROLE_ID')} role)`;
			}

			message.reply(
				`${reply}.`,
				{ allowedMentions: { parse: [] } },
			);
		} finally {
			message.channel.stopTyping(true);
		}
	}
};
