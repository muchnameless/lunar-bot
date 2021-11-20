import { SlashCommandBuilder } from '@discordjs/builders';
import pkg from 'sequelize';
const { Op } = pkg;
import { oneLine } from 'common-tags';
import { requiredPlayerOption } from '../../structures/commands/commonOptions';
import { seconds } from '../../functions';
import { InteractionUtil } from '../../util';
import { ApplicationCommand } from '../../structures/commands/ApplicationCommand';
import type { CommandInteraction } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';

export default class UnlinkCommand extends ApplicationCommand {
	constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder()
				.setDescription('remove a link between a discord user and a minecraft ign')
				.addStringOption(requiredPlayerOption),
			cooldown: seconds(1),
		});
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async runSlash(interaction: CommandInteraction) {
		const PLAYER_INPUT = interaction.options.getString('player', true);
		const player =
			InteractionUtil.getPlayer(interaction) ??
			(await this.client.players.fetch({
				[Op.or]: [
					{
						ign: { [Op.iLike]: PLAYER_INPUT },
						minecraftUuid: PLAYER_INPUT.toLowerCase(),
						discordId: PLAYER_INPUT,
					},
				],
				cache: false,
			}));

		if (!player?.discordId) return InteractionUtil.reply(interaction, `\`${PLAYER_INPUT}\` is not linked`);

		const { discordId: OLD_LINKED_ID } = player;
		const currentLinkedMember = await player.fetchDiscordMember();
		const WAS_SUCCESSFUL = await player.unlink(`unlinked by ${interaction.user.tag}`);

		return InteractionUtil.reply(interaction, {
			content: oneLine`
				\`${player}\` is no longer linked to ${currentLinkedMember ?? `\`${OLD_LINKED_ID}\``}
				${WAS_SUCCESSFUL ? '' : ' (unable to update the currently linked member)'}
			`,
			allowedMentions: { parse: [] },
		});
	}
}
