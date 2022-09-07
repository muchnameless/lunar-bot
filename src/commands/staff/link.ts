import { stripIndents } from 'common-tags';
import {
	DiscordAPIError,
	RESTJSONErrorCodes,
	SlashCommandBuilder,
	type ChatInputCommandInteraction,
	type User,
} from 'discord.js';
import { hypixel, mojang } from '#api';
import { seconds, validateNumber } from '#functions';
import { logger } from '#logger';
import { ApplicationCommand } from '#structures/commands/ApplicationCommand.js';
import { type CommandContext } from '#structures/commands/BaseCommand.js';
import { hypixelGuildOption, requiredIgnOption } from '#structures/commands/commonOptions.js';
import { type Player } from '#structures/database/models/Player.js';
import { InteractionUtil, UserUtil } from '#utils';

export default class LinkCommand extends ApplicationCommand {
	public constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder()
				.setDescription('link a discord user to a minecraft ign')
				.addStringOption(requiredIgnOption)
				.addUserOption((option) =>
					option //
						.setName('user')
						.setDescription('discord user')
						.setRequired(true),
				)
				.addStringOption(hypixelGuildOption),
			cooldown: seconds(1),
		});
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 */
	public override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		const IGN_OR_UUID = interaction.options.getString('ign', true);

		let uuid: string | undefined;
		let ign: string | undefined;
		let guildId: string | null = null;

		try {
			({ uuid, ign } = await mojang.ignOrUuid(IGN_OR_UUID));
			guildId = (await hypixel.guild.player(uuid)).guild?._id ?? null;
		} catch (error) {
			logger.error(error, '[LINK]');
		}

		let player: Player | null = null;

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
			throw stripIndents`
				\`${IGN_OR_UUID}\` is neither a valid IGN nor minecraft uuid.
				Make sure to provide the full ign if the player database is not already updated (check ${
					this.client.logHandler.channel ?? '#lunar-logs'
				})
			`;
		}

		const { hypixelGuild } = player;

		if (interaction.user.id !== this.client.ownerId) {
			if (!hypixelGuild) {
				throw `\`${player}\` is not in a cached hypixel guild`;
			}

			// check if executor is staff in the player's hypixel guild's discord guild
			if (hypixelGuild.guildId !== InteractionUtil.getHypixelGuild(interaction).guildId) {
				throw `you can only link players in ${hypixelGuild}'s discord server`;
			}

			if (player.isStaff) {
				throw `\`${player}\` is a staff member and cannot be manually linked`;
			}
		}

		const user = interaction.options.getUser('user', true);

		// discordId already linked to another player
		const playerLinkedToId =
			UserUtil.getPlayer(user) ??
			(await this.client.players.fetch({
				discordId: user.id,
				cache: false,
			}));

		if (playerLinkedToId) {
			if (playerLinkedToId.minecraftUuid === player.minecraftUuid) {
				return InteractionUtil.reply(interaction, {
					content: `\`${player}\` is already linked to ${user}`,
					allowedMentions: { parse: [] },
				});
			}

			let linkedUserIsDeleted = false;
			let linkedUser: User | null = null;

			try {
				linkedUser = await playerLinkedToId.fetchDiscordUser();
			} catch (error) {
				if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownUser) {
					linkedUserIsDeleted = true;
					logger.error(
						{ err: error, ...player.logInfo, discordId: playerLinkedToId.discordId },
						'[LINK]: deleted discord user',
					);
				} else {
					logger.error({ err: error, ...player.logInfo }, '[LINK]: error fetching already linked user');
				}
			}

			if (!linkedUserIsDeleted) {
				await InteractionUtil.awaitConfirmation(interaction, {
					question: `${linkedUser ?? `\`${user}\``} is already linked to \`${playerLinkedToId}\`. Overwrite this?`,
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
			let linkedUser: User | null = null;

			try {
				linkedUser = await player.fetchDiscordUser();

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
				logger.error(
					{ err: error, ...player.logInfo, discordId: player.discordId },
					'[LINK]: overwrite already linked user',
				);
			}

			if (!(await player.unlink(`unlinked by ${interaction.user.tag}`)) && linkedUser) {
				await InteractionUtil.reply(interaction, {
					content: `unable to update roles and nickname for the currently linked member ${linkedUser}`,
					allowedMentions: { parse: [] },
				});
			}
		}

		// try to find the linked users member data
		const guild = hypixelGuild?.discordGuild;
		const discordMember =
			interaction.options.getMember('user') ??
			(await guild?.members
				.fetch(user)
				.catch((error) => logger.error(error, '[LINK]: error fetching member to link'))) ??
			null;

		// no discord member for the user to link found
		if (!discordMember) {
			await player.link(user.id);
			return InteractionUtil.reply(
				interaction,
				`\`${player}\` linked to \`${user}\` but could not be found on the ${
					guild?.name ?? '(currently unavailable)'
				} discord server`,
			);
		}

		// user to link is in discord -> update roles
		await player.link(discordMember, `linked by ${interaction.user.tag}`);

		let reply = `\`${player}\` linked to ${discordMember}`;

		// eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
		const MANDATORY_ROLE_ID = this.client.discordGuilds.cache.get(hypixelGuild?.discordId!)?.MANDATORY_ROLE_ID;

		if (MANDATORY_ROLE_ID && !discordMember.roles.cache.has(MANDATORY_ROLE_ID)) {
			reply += ` (missing ${guild?.roles.cache.get(MANDATORY_ROLE_ID)?.name ?? MANDATORY_ROLE_ID} role)`;
		}

		return InteractionUtil.reply(interaction, {
			content: reply,
			allowedMentions: { parse: [] },
		});
	}
}
