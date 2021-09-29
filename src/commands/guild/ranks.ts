import { SlashCommandBuilder } from '@discordjs/builders';
import { optionalPlayerOption, buildGuildOption } from '../../structures/commands/commonOptions';
import { InteractionUtil } from '../../util';
import { SlashCommand } from '../../structures/commands/SlashCommand';
import type { CommandInteraction } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';


export default class RanksCommand extends SlashCommand {
	constructor(context: CommandContext) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('guild ranks and requirements')
				.addStringOption(optionalPlayerOption)
				.addStringOption(buildGuildOption(context.client)),
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async runSlash(interaction: CommandInteraction) {
		const hypixelGuild = InteractionUtil.getHypixelGuild(interaction);
		const player = InteractionUtil.getPlayer(interaction, true);
		const embed = this.client.defaultEmbed;

		// no player
		if (!player) {
			for (const { name, positionReq, currentWeightReq } of hypixelGuild.ranks) {
				if (positionReq == null || positionReq === 0) continue;

				embed.addFields({
					name: `${name} (top ${Math.round((1 - positionReq) * 100)}%)`,
					value: `${this.client.formatNumber(currentWeightReq!)} weight`,
				});
			}

			return await InteractionUtil.reply(interaction, { embeds: [ embed ] });
		}

		// player found
		embed
			.setAuthor(`${player}${player.mainProfileName ? ` (${player.mainProfileName})` : ''}`, (await player.imageURL)!, player.url)
			.setFooter('Updated at')
			.setTimestamp(player.xpLastUpdatedAt);

		const weight = player.getSenitherWeight().totalWeight;

		for (const { name, positionReq, currentWeightReq } of hypixelGuild.ranks) {
			if (positionReq == null || positionReq === 0 || currentWeightReq == null) continue;

			embed.addFields({
				name: `${name} (top ${Math.round((1 - positionReq) * 100)}%)`,
				value: `${this.client.formatNumber(Math.floor(weight))} / ${this.client.formatNumber(currentWeightReq)} weight (${this.client.formatNumber(Math.floor(Math.abs(currentWeightReq - weight)))} ${weight < currentWeightReq ? 'below' : 'above'})`,
			});
		}

		return await InteractionUtil.reply(interaction, { embeds: [ embed ] });
	}
}
