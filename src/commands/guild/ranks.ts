import { SlashCommandBuilder } from '@discordjs/builders';
import { hypixelGuildOption, optionalPlayerOption } from '../../structures/commands/commonOptions';
import { InteractionUtil } from '../../util';
import { ApplicationCommand } from '../../structures/commands/ApplicationCommand';
import { formatNumber } from '../../functions';
import type { CommandInteraction } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';

export default class RanksCommand extends ApplicationCommand {
	constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder()
				.setDescription('guild ranks and requirements')
				.addStringOption(optionalPlayerOption)
				.addStringOption(hypixelGuildOption),
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async runSlash(interaction: CommandInteraction) {
		const hypixelGuild = InteractionUtil.getHypixelGuild(interaction);
		const player = InteractionUtil.getPlayer(interaction, { fallbackToCurrentUser: true });
		const embed = this.client.defaultEmbed.setFooter({ text: hypixelGuild.name });

		// no player
		if (!player) {
			for (const { name, positionReq, currentWeightReq } of hypixelGuild.ranks) {
				if (positionReq == null || positionReq === 0) continue;

				embed.addFields({
					name: `${name} (top ${Math.round((1 - positionReq) * 100)}%)`,
					value: `${formatNumber(currentWeightReq!)} weight`,
				});
			}

			return InteractionUtil.reply(interaction, { embeds: [embed] });
		}

		// player found
		embed
			.setAuthor({
				name: `${player}${player.mainProfileName ? ` (${player.mainProfileName})` : ''}`,
				iconURL: (await player.imageURL)!,
				url: player.url,
			})
			.setFooter({ text: 'Updated at' })
			.setTimestamp(player.xpLastUpdatedAt);

		const weight = player.getLilyWeight().totalWeight;

		for (const { name, positionReq, currentWeightReq } of hypixelGuild.ranks) {
			if (positionReq == null || positionReq === 0 || currentWeightReq == null) continue;

			embed.addFields({
				name: `${name} (top ${Math.round((1 - positionReq) * 100)}%)`,
				value: `${formatNumber(Math.floor(weight))} / ${formatNumber(currentWeightReq)} weight (${formatNumber(
					Math.floor(Math.abs(currentWeightReq - weight)),
				)} ${weight < currentWeightReq ? 'below' : 'above'})`,
			});
		}

		return InteractionUtil.reply(interaction, { embeds: [embed] });
	}
}
