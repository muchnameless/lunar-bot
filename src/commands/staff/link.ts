import { SlashCommandBuilder } from '@discordjs/builders';
import { DiscordAPIError, Constants } from 'discord.js';
import { stripIndents } from 'common-tags';
import { hypixel } from '../../api/hypixel';
import { mojang } from '../../api/mojang';
import { requiredIgnOption } from '../../structures/commands/commonOptions';
import { InteractionUtil } from '../../util';
import { logger, validateNumber } from '../../functions';
import { SlashCommand } from '../../structures/commands/SlashCommand';
import type { CommandInteraction, GuildMember, Snowflake } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';


export default class LinkCommand extends SlashCommand {
	constructor(context: CommandContext) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('link a discord user to a minecraft ign')
				.addStringOption(requiredIgnOption)
				.addUserOption(option => option
					.setName('user')
					.setDescription('discord user')
					.setRequired(true),
				),
			cooldown: 1,
		});
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async runSlash(interaction: CommandInteraction) {
		const IGN_OR_UUID = interaction.options.getString('ign', true);

		let uuid;
		let ign;
		let guildId;

		try {
			({ uuid, ign } = await mojang.ignOrUuid(IGN_OR_UUID));
			({ _id: guildId } = await hypixel.guild.player(uuid));
		} catch (error) {
			logger.error('[LINK]', error);
		}

		let player;

		if (!guildId || !this.client.hypixelGuilds.cache.has(guildId)) { // IGN_OR_Uuid is neither a valid ign nor uuid from a player in the guild -> autocomplete to IGN
			player = this.client.players.getByIgn(IGN_OR_UUID);

			if (player) ({ minecraftUuid: uuid, ign } = player);
		} else if (uuid) { // IGN_OR_Uuid could be resolved to a valid uuid in guild
			player = this.client.players.cache.get(uuid)
				?? (await this.client.players.model.findCreateFind({
					where: { minecraftUuid: uuid },
					defaults: {
						minecraftUuid: uuid,
						ign,
						guildId,
					},
				}))?.[0];
		}

		if (!player) return InteractionUtil.reply(interaction, stripIndents`
			\`${IGN_OR_UUID}\` is neither a valid IGN nor minecraft uuid.
			Make sure to provide the full ign if the player database is not already updated (check ${this.client.loggingChannel ?? '#lunar-logs'})
		`);

		const USER_ID = interaction.options.get('user', true).value as Snowflake;

		// discordId already linked to another player
		const playerLinkedToId = this.client.players.getById(USER_ID)
			?? await this.client.players.fetch({
				discordId: USER_ID,
				cache: false,
			});

		if (playerLinkedToId) {
			let linkedUserIsDeleted = false;

			const linkedUser = await playerLinkedToId.discordUser.catch((error) => {
				if (error instanceof DiscordAPIError && error.code === Constants.APIErrors.UNKNOWN_USER) {
					linkedUserIsDeleted = true;
					return logger.error(`[LINK]: ${playerLinkedToId.logInfo}: deleted discord user: ${playerLinkedToId.discordId}`, error);
				}
				return logger.error(`[LINK]: ${playerLinkedToId.logInfo}: error fetching already linked user`, error);
			});

			if (!linkedUserIsDeleted) {
				await InteractionUtil.awaitConfirmation(interaction, {
					question: `${linkedUser ?? `\`${USER_ID}\``} is already linked to \`${playerLinkedToId}\`. Overwrite this?`,
					allowedMentions: { parse: [] },
				});
			}

			if (!await playerLinkedToId.unlink(`unlinked by ${interaction.user.tag}`) && linkedUser) {
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

				if (player.discordId === USER_ID) return InteractionUtil.reply(interaction, {
					content: `\`${player}\` is already linked to ${linkedUser ?? `\`${player.discordId}\``}`,
					allowedMentions: { parse: [] },
				});

				await InteractionUtil.awaitConfirmation(interaction, {
					question: stripIndents`
						\`${player}\` is already linked to ${linkedUser ?? `\`${player.discordId}\``}. Overwrite this?
						Make sure to provide the full ign if the player database is not already updated (check ${this.client.loggingChannel ?? '#lunar-logs'})
					`,
					allowedMentions: { parse: [] },
				});
			} catch (error) {
				if (error instanceof DiscordAPIError && error.code === Constants.APIErrors.UNKNOWN_USER) {
					logger.error(`[LINK]: ${player.logInfo}: deleted discord user: ${player.discordId}`);
				} else {
					logger.error(`[LINK]: ${player.logInfo}: error fetching already linked user`, error);
				}
			}

			if (!await player.unlink(`unlinked by ${interaction.user.tag}`) && linkedUser) {
				await InteractionUtil.reply(interaction, {
					content: `unable to update roles and nickname for the currently linked member ${linkedUser}`,
					allowedMentions: { parse: [] },
				});
			}
		}

		// try to find the linked users member data
		const discordMember = interaction.options.getMember('user') as GuildMember
			?? await this.client.lgGuild?.members.fetch(USER_ID).catch(error => logger.error('[LINK]: error fetching member to link', error))
			?? null;

		// no discord member for the user to link found
		if (!discordMember) {
			await player.link(USER_ID);
			return InteractionUtil.reply(interaction, `\`${player}\` linked to \`${USER_ID}\` but could not be found on the Lunar Guard discord server`);
		}

		// user to link is in discord -> update roles
		await player.link(discordMember, `linked by ${interaction.user.tag}`);

		let reply = `\`${player}\` linked to ${discordMember}`;

		if (!discordMember.roles.cache.has(this.config.get('VERIFIED_ROLE_ID')))	{
			reply += ` (missing ${this.client.lgGuild?.roles.cache.get(this.config.get('VERIFIED_ROLE_ID'))?.name ?? this.config.get('VERIFIED_ROLE_ID')} role)`;
		}

		return InteractionUtil.reply(interaction, {
			content: reply,
			allowedMentions: { parse: [] },
		});
	}
}
