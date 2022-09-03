import { type Components } from '@zikeji/hypixel';
import { SlashCommandBuilder, userMention, type ChatInputCommandInteraction } from 'discord.js';
import { Op } from 'sequelize';
import { hypixel, mojang } from '#api';
import { formatError } from '#functions';
import { logger } from '#logger';
import { ApplicationCommand } from '#structures/commands/ApplicationCommand.js';
import { type CommandContext } from '#structures/commands/BaseCommand.js';
import { requiredIgnOption } from '#structures/commands/commonOptions.js';
import { InteractionUtil, UserUtil } from '#utils';

export default class VerifyCommand extends ApplicationCommand {
	public constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder()
				.setDescription('link your discord account to your minecraft account')
				.addStringOption(requiredIgnOption),
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 */
	public override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		const IGN = interaction.options.getString('ign', true);
		const playerLinkedToId =
			UserUtil.getPlayer(interaction.user) ??
			(await this.client.players.fetch({ discordId: interaction.user.id, cache: false }));

		let player =
			this.client.players.getByIgn(IGN) ??
			(await this.client.players.fetch({
				[Op.or]: [
					{
						ign: { [Op.iLike]: IGN },
						minecraftUuid: IGN.toLowerCase(),
					},
				],
				cache: false,
			}));

		// already linked to this discord user
		if (player && player.minecraftUuid === playerLinkedToId?.minecraftUuid) {
			return InteractionUtil.reply(interaction, 'you are already linked with this discord account');
		}

		let uuid: string;
		let ign: string;
		let hypixelPlayer: Components.Schemas.NullablePlayer;

		// API requests
		try {
			({ uuid, ign } = await mojang.ignOrUuid(IGN));

			({ player: hypixelPlayer } = await hypixel.player.uuid(uuid));
		} catch (error) {
			logger.error(error);
			return InteractionUtil.reply(interaction, formatError(error));
		}

		const LINKED_DISCORD_TAG = hypixelPlayer?.socialMedia?.links?.DISCORD;

		// no linked discord tag
		if (!LINKED_DISCORD_TAG) {
			return InteractionUtil.reply(interaction, `no linked discord tag for \`${ign}\` on hypixel`);
		}

		// linked discord tag doesn't match user's tag
		if (LINKED_DISCORD_TAG !== interaction.user.tag) {
			return InteractionUtil.reply(
				interaction,
				`the linked discord tag \`${LINKED_DISCORD_TAG}\` for \`${ign}\` does not match yours: \`${interaction.user.tag}\``,
			);
		}

		// already linked to another discord user
		if (playerLinkedToId) {
			await InteractionUtil.awaitConfirmation(
				interaction,
				`your discord account is already linked to \`${playerLinkedToId}\`. Overwrite this?`,
			);

			await playerLinkedToId.unlink(`linked account switched to ${interaction.user.tag}`);
		}

		// player db entry not cached -> find or create
		if (!player) {
			try {
				[player] = await this.client.players.model.findCreateFind({
					where: { minecraftUuid: uuid },
					defaults: {
						minecraftUuid: uuid,
						ign,
					},
				});
			} catch (error) {
				logger.error(error, '[VERIFY]: database');
				return InteractionUtil.reply(
					interaction,
					`an error occurred while updating the guild player database. Contact ${userMention(this.client.ownerId)}`,
				);
			}
		}

		// link player
		const discordMember =
			interaction.member ??
			(await InteractionUtil.getHypixelGuild(interaction)
				.discordGuild?.members.fetch(interaction.user)
				.catch((error) => logger.error(error, '[VERIFY]: guild member fetch'))) ??
			null;

		await player.link(discordMember ?? interaction.user.id, 'verified with the bot');

		return InteractionUtil.reply(interaction, `successfully linked your discord account to \`${ign}\``);
	}
}
