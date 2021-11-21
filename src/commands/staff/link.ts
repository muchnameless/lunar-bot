import { SlashCommandBuilder } from '@discordjs/builders';
import { DiscordAPIError } from 'discord.js';
import { RESTJSONErrorCodes } from 'discord-api-types/v9';
import { stripIndents } from 'common-tags';
import { hypixel, mojang } from '../../api';
import { requiredIgnOption } from '../../structures/commands/commonOptions';
import { InteractionUtil, UserUtil } from '../../util';
import { logger, seconds, validateNumber } from '../../functions';
import { ApplicationCommand } from '../../structures/commands/ApplicationCommand';
import type { CommandInteraction, GuildMember, Snowflake } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';

export default class LinkCommand extends ApplicationCommand {
	constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder()
				.setDescription('link a discord user to a minecraft ign')
				.addStringOption(requiredIgnOption)
				.addUserOption((option) => option.setName('user').setDescription('discord user').setRequired(true)),
			cooldown: seconds(1),
		});
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async runSlash(interaction: CommandInteraction) {
		const IGN_OR_UUID = interaction.options.getString('ign', true);

		let uuid: string | undefined;
		let ign: string | undefined;
		let guildId: string | null = null;

		try {
			({ uuid, ign } = await mojang.ignOrUuid(IGN_OR_UUID));
			({ _id: guildId } = await hypixel.guild.player(uuid));
		} catch (error) {
			logger.error(error, '[LINK]');
		}

		let player;

		if (!guildId || !this.client.hypixelGuilds.cache.has(guildId)) {
			// IGN_OR_Uuid is neither a valid ign nor uuid from a player in the guild -> autocomplete to IGN
			player = this.client.players.getByIgn(IGN_OR_UUID);

			if (player) ({ minecraftUuid: uuid, ign, guildId } = player);
		} else if (uuid) {
			// IGN_OR_Uuid could be resolved to a valid uuid in guild
			player =
				this.client.players.cache.get(uuid) ??
				(
					await this.client.players.model.findCreateFind({
						where: { minecraftUuid: uuid },
						defaults: {
							minecraftUuid: uuid,
							ign,
							guildId,
						},
					})
				)?.[0];
		}

		if (!player) {
			return InteractionUtil.reply(interaction, {
				content: stripIndents`
					\`${IGN_OR_UUID}\` is neither a valid IGN nor minecraft uuid.
					Make sure to provide the full ign if the player database is not already updated (check ${
						this.client.logHandler.channel ?? '#lunar-logs'
					})
				`,
				ephemeral: true,
			});
		}

		const { hypixelGuild } = player;
		const discordGuild = hypixelGuild?.discordGuild;

		if (interaction.user.id !== this.client.ownerId) {
			if (!hypixelGuild) {
				return InteractionUtil.reply(interaction, {
					content: `\`${player}\` is not in a cached hypixel guild`,
					ephemeral: true,
				});
			}

			// check if executor is staff in the player's hypixel guild's discord guild
			if (UserUtil.getPlayer(interaction.user)?.hypixelGuild?.discordId !== discordGuild?.id) {
				return InteractionUtil.reply(interaction, {
					content: `you need to be staff in ${discordGuild}'s discord server`,
					ephemeral: true,
				});
			}
		}

		const USER_ID = interaction.options.get('user', true).value as Snowflake;

		// discordId already linked to another player
		const playerLinkedToId =
			this.client.players.getById(USER_ID) ??
			(await this.client.players.fetch({
				discordId: USER_ID,
				cache: false,
			}));

		if (playerLinkedToId) {
			let linkedUserIsDeleted = false;

			const linkedUser = await playerLinkedToId.discordUser.catch((error) => {
				if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownUser) {
					linkedUserIsDeleted = true;
					return logger.error(
						error,
						`[LINK]: ${playerLinkedToId.logInfo}: deleted discord user: ${playerLinkedToId.discordId}`,
					);
				}
				return logger.error(error, `[LINK]: ${playerLinkedToId.logInfo}: error fetching already linked user`);
			});

			if (!linkedUserIsDeleted) {
				await InteractionUtil.awaitConfirmation(interaction, {
					question: `${linkedUser ?? `\`${USER_ID}\``} is already linked to \`${playerLinkedToId}\`. Overwrite this?`,
					allowedMentions: { parse: [] },
				});
			}

			if (!(await playerLinkedToId.unlink(`unlinked by ${interaction.user.tag}`)) && linkedUser) {
				await InteractionUtil.reply(interaction, {
					content: `unable to update roles and nickname for the currently linked member ${linkedUser}`,
					allowedMentions: { parse: [] },
				});
			}
		}

		// player already linked
		if (validateNumber(player.discordId)) {
			let linkedUser;

			try {
				linkedUser = await player.discordUser;

				if (player.discordId === USER_ID) {
					return InteractionUtil.reply(interaction, {
						content: `\`${player}\` is already linked to ${linkedUser ?? `\`${player.discordId}\``}`,
						allowedMentions: { parse: [] },
					});
				}

				await InteractionUtil.awaitConfirmation(interaction, {
					question: stripIndents`
						\`${player}\` is already linked to ${linkedUser ?? `\`${player.discordId}\``}. Overwrite this?
						Make sure to provide the full ign if the player database is not already updated (check ${
							this.client.logHandler.channel ?? '#lunar-logs'
						})
					`,
					allowedMentions: { parse: [] },
				});
			} catch (error) {
				if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownUser) {
					logger.error(`[LINK]: ${player.logInfo}: deleted discord user: ${player.discordId}`);
				} else {
					logger.error(error, `[LINK]: ${player.logInfo}: error fetching already linked user`);
				}
			}

			if (!(await player.unlink(`unlinked by ${interaction.user.tag}`)) && linkedUser) {
				await InteractionUtil.reply(interaction, {
					content: `unable to update roles and nickname for the currently linked member ${linkedUser}`,
					allowedMentions: { parse: [] },
				});
			}
		}

		// try to find the linked users member data
		const discordMember =
			(interaction.options.getMember('user') as GuildMember) ??
			(await discordGuild?.members
				.fetch(USER_ID)
				.catch((error) => logger.error(error, '[LINK]: error fetching member to link'))) ??
			null;

		// no discord member for the user to link found
		if (!discordMember) {
			await player.link(USER_ID);
			return InteractionUtil.reply(
				interaction,
				`\`${player}\` linked to \`${USER_ID}\` but could not be found on the ${
					discordGuild?.name ?? '(currently unavailable)'
				} discord server`,
			);
		}

		// user to link is in discord -> update roles
		await player.link(discordMember, `linked by ${interaction.user.tag}`);

		let reply = `\`${player}\` linked to ${discordMember}`;

		const { MANDATORY } = hypixelGuild!.roleIds;

		if (MANDATORY && !discordMember.roles.cache.has(MANDATORY)) {
			reply += ` (missing ${hypixelGuild!.discordGuild?.roles.cache.get(MANDATORY)?.name ?? MANDATORY} role)`;
		}

		return InteractionUtil.reply(interaction, {
			content: reply,
			allowedMentions: { parse: [] },
		});
	}
}
