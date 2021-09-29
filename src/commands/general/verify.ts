import { SlashCommandBuilder } from '@discordjs/builders';
import pkg from 'sequelize';
const { Op } = pkg;
import { oneLine, commaListsOr } from 'common-tags';
import { hypixel } from '../../api/hypixel';
import { mojang } from '../../api/mojang';
import { requiredIgnOption } from '../../structures/commands/commonOptions';
import { InteractionUtil, UserUtil } from '../../util';
import { logger } from '../../functions';
import { SlashCommand } from '../../structures/commands/SlashCommand';
import type { CommandInteraction, GuildMember } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';


export default class VerifyCommand extends SlashCommand {
	constructor(context: CommandContext) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('link your discord account to your minecraft account (guild members only)')
				.addStringOption(requiredIgnOption),
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async runSlash(interaction: CommandInteraction) {
		const IGN = interaction.options.getString('ign', true);
		const playerLinkedToId = UserUtil.getPlayer(interaction.user);

		let player = this.client.players.getByIgn(IGN)
			?? await this.client.players.fetch({
				[Op.or]: [{
					ign: { [Op.iLike]: IGN },
					minecraftUuid: IGN.toLowerCase(),
				}],
				cache: false,
			});

		// already linked to this discord user
		if (player && player.minecraftUuid === playerLinkedToId?.minecraftUuid) return await InteractionUtil.reply(interaction, 'you are already linked with this discord account');

		let uuid;
		let ign;
		let guildId;
		let hypixelPlayer;

		try {
			({ uuid, ign } = await mojang.ign(IGN));
			({ _id: guildId } = await hypixel.guild.player(uuid));

			// not in one of the guilds that the bot manages
			if (!this.client.hypixelGuilds.cache.has(guildId)) {
				return await InteractionUtil.reply(interaction, commaListsOr`according to the hypixel API, \`${ign}\` is not in ${this.client.hypixelGuilds.cache.map(({ name }) => name)}`);
			}

			hypixelPlayer = await hypixel.player.uuid(uuid);
		} catch (error) {
			logger.error(error);
			return await InteractionUtil.reply(interaction, `${error}`);
		}

		const LINKED_DISCORD_TAG = hypixelPlayer?.socialMedia?.links?.DISCORD;

		// no linked discord tag
		if (!LINKED_DISCORD_TAG) return await InteractionUtil.reply(interaction, `no linked discord tag for \`${ign}\` on hypixel`);

		// linked discord tag doesn't match author's tag
		if (LINKED_DISCORD_TAG !== interaction.user.tag) return await InteractionUtil.reply(interaction, oneLine`
			the linked discord tag \`${LINKED_DISCORD_TAG}\` for \`${ign}\` does not match yours: \`${interaction.user.tag}\`.
			Keep in mind that discord tags are case sensitive
		`);

		// already linked to another discord user
		if (playerLinkedToId) {
			await InteractionUtil.awaitConfirmation(interaction, `your discord account is already linked to \`${playerLinkedToId}\`. Overwrite this?`);

			await playerLinkedToId.unlink(`linked account switched to ${interaction.user.tag}`);
		}

		// create new db entry if non exitent
		try {
			if (!player) [ player ] = await this.client.players.model.findCreateFind({
				where: { minecraftUuid: uuid },
				defaults: {
					minecraftUuid: uuid,
					ign,
					guildId,
				},
			});
		} catch (error) {
			logger.error('[VERIFY]: database', error);
			return await InteractionUtil.reply(interaction, `an error occurred while updating the guild player database. Contact ${await this.client.ownerInfo}`);
		}

		player.guildId = guildId;

		const discordMember = interaction.member as GuildMember
			?? await this.client.lgGuild?.members.fetch(interaction.user).catch(error => logger.error('[VERIFY]: guild member fetch', error))
			?? null;

		await player.link(discordMember ?? interaction.user.id, 'verified with the bot');

		return await InteractionUtil.reply(interaction, `successfully linked your discord account to \`${ign}\``);
	}
}
