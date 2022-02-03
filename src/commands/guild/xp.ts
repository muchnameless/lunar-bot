import { SlashCommandBuilder } from '@discordjs/builders';
import { Embed, Formatters } from 'discord.js';
import { stripIndents } from 'common-tags';
import {
	COSMETIC_SKILLS,
	DUNGEON_TYPES_AND_CLASSES,
	SKILLS,
	SLAYERS,
	XP_OFFSETS_CONVERTER,
	XP_OFFSETS_TIME,
} from '../../constants';
import { optionalPlayerOption, pageOption, offsetOption } from '../../structures/commands/commonOptions';
import { InteractionUtil, MessageEmbedUtil } from '../../util';
import { formatDecimalNumber, formatNumber, getDefaultOffset, upperCaseFirstChar } from '../../functions';
import { ApplicationCommand } from '../../structures/commands/ApplicationCommand';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { XPOffsets } from '../../constants';
import type { CommandContext } from '../../structures/commands/BaseCommand';

export default class XpCommand extends ApplicationCommand {
	constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder()
				.setDescription("check a player's xp gained")
				.addStringOption(optionalPlayerOption)
				.addIntegerOption(pageOption)
				.addStringOption(offsetOption)
				.addBooleanOption((option) =>
					option.setName('update').setDescription('update xp before running the command').setRequired(false),
				),
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async runSlash(interaction: ChatInputCommandInteraction) {
		const player = InteractionUtil.getPlayer(interaction, { fallbackToCurrentUser: true, throwIfNotFound: true });
		const OFFSET = (interaction.options.getString('offset') as XPOffsets) ?? getDefaultOffset(this.config);

		// update db?
		if (interaction.options.getBoolean('update')) await player.updateXp();

		const embeds: Embed[] = [];
		const { skillAverage, trueAverage } = player.getSkillAverage();
		const { skillAverage: skillAverageOffset, trueAverage: trueAverageOffset } = player.getSkillAverage(OFFSET);

		let embed = new Embed()
			.setColor(this.config.get('EMBED_BLUE'))
			.setAuthor({
				name: `${player}${player.mainProfileName ? ` (${player.mainProfileName})` : ''}`,
				iconURL: player.imageURL,
				url: player.url,
			})
			.setDescription(
				`${`Δ: change since ${Formatters.time(
					new Date(
						Math.max(
							this.config.get(XP_OFFSETS_TIME[OFFSET as keyof typeof XP_OFFSETS_TIME]),
							player.createdAt.getTime(),
						),
					),
				)} (${upperCaseFirstChar(XP_OFFSETS_CONVERTER[OFFSET as keyof typeof XP_OFFSETS_CONVERTER])})`.padEnd(
					105,
					'\u00A0',
				)}\u200B`,
			)
			.addFields({
				name: '\u200B',
				value: stripIndents`
					${Formatters.codeBlock('Skills')}
					Average skill level: ${Formatters.bold(formatDecimalNumber(skillAverage))} [${Formatters.bold(
					formatDecimalNumber(trueAverage),
				)}] - ${Formatters.bold('Δ')}: ${Formatters.bold(
					formatDecimalNumber(skillAverage - skillAverageOffset),
				)} [${Formatters.bold(formatDecimalNumber(trueAverage - trueAverageOffset))}]
				`,
			});

		// skills
		for (const skill of SKILLS) {
			const SKILL_ARGUMENT = `${skill}Xp` as const;
			const OFFSET_ARGUMENT = `${skill}Xp${OFFSET}` as const;
			const { progressLevel } = player.getSkillLevel(skill);

			embed.addFields({
				name: upperCaseFirstChar(skill),
				value: stripIndents`
					${Formatters.bold('Lvl:')} ${progressLevel}
					${Formatters.bold('XP:')} ${formatNumber(Math.round(player[SKILL_ARGUMENT]))}
					${Formatters.bold('Δ:')} ${formatNumber(Math.round(player[SKILL_ARGUMENT] - player[OFFSET_ARGUMENT]))}
				`,
				inline: true,
			});
		}

		MessageEmbedUtil.padFields(embed);

		for (const skill of COSMETIC_SKILLS) {
			const SKILL_ARGUMENT = `${skill}Xp` as const;
			const { progressLevel } = player.getSkillLevel(skill);

			embed.addFields({
				name: upperCaseFirstChar(skill),
				value: stripIndents`
					${Formatters.bold('Lvl:')} ${progressLevel}
					${Formatters.bold('XP:')} ${formatNumber(Math.round(player[SKILL_ARGUMENT]))}
					${Formatters.bold('Δ:')} ${formatNumber(Math.round(player[SKILL_ARGUMENT] - player[`${skill}Xp${OFFSET}`]))}
				`,
				inline: true,
			});
		}

		MessageEmbedUtil.padFields(embed);

		// slayer
		const TOTAL_SLAYER_XP = player.getSlayerTotal();

		embed.addFields({
			name: '\u200B',
			value: stripIndents`
				${Formatters.codeBlock('Slayer')}
				Total slayer xp: ${Formatters.bold(formatNumber(TOTAL_SLAYER_XP))} - ${Formatters.bold('Δ')}: ${Formatters.bold(
				formatNumber(TOTAL_SLAYER_XP - player.getSlayerTotal(OFFSET)),
			)}
			`,
			inline: false,
		});

		for (const slayer of SLAYERS) {
			const SLAYER_ARGUMENT = `${slayer}Xp` as const;

			embed.addFields({
				name: upperCaseFirstChar(slayer),
				value: stripIndents`
					${Formatters.bold('Lvl:')} ${player.getSlayerLevel(slayer)}
					${Formatters.bold('XP:')} ${formatNumber(player[SLAYER_ARGUMENT])}
					${Formatters.bold('Δ:')} ${formatNumber(Math.round(player[SLAYER_ARGUMENT] - player[`${slayer}Xp${OFFSET}`]))}
				`,
				inline: true,
			});
		}

		embeds.push(embed);

		embed = this.client.defaultEmbed
			.setDescription(`\u200B${''.padEnd(171, '\u00A0')}\u200B\n${Formatters.codeBlock('Dungeons')}`)
			.setFooter({ text: '\u200B\nUpdated at' })
			.setTimestamp(player.xpLastUpdatedAt);

		// dungeons
		for (const type of DUNGEON_TYPES_AND_CLASSES) {
			const DUNGEON_ARGUMENT = `${type}Xp` as const;
			const { progressLevel } = player.getSkillLevel(type);

			embed.addFields({
				name: upperCaseFirstChar(type),
				value: stripIndents`
					${Formatters.bold('Lvl:')} ${progressLevel}
					${Formatters.bold('XP:')} ${formatNumber(Math.round(player[DUNGEON_ARGUMENT]))}
					${Formatters.bold('Δ:')} ${formatNumber(Math.round(player[DUNGEON_ARGUMENT] - player[`${type}Xp${OFFSET}`]))}
				`,
				inline: true,
			});
		}

		const { totalWeight, weight, overflow } = player.getLilyWeight();
		const {
			totalWeight: totalWeightOffet,
			weight: weightOffset,
			overflow: overflowOffset,
		} = player.getLilyWeight(OFFSET);

		MessageEmbedUtil.padFields(embed).addFields(
			{
				name: '\u200B',
				value: `${Formatters.codeBlock('Miscellaneous')}\u200B`,
				inline: false,
			},
			{
				name: 'Hypixel Guild XP',
				value: stripIndents`
					${Formatters.bold('Total:')} ${formatNumber(player.guildXp)}
					${Formatters.bold('Δ:')} ${formatNumber(player.guildXp - player[`guildXp${OFFSET}`])}
				`,
				inline: true,
			},
			{
				name: 'Lily Weight',
				value: stripIndents`
					${Formatters.bold('Total')}: ${formatDecimalNumber(totalWeight)} [ ${formatDecimalNumber(
					weight,
				)} + ${formatDecimalNumber(overflow)} ]
					${Formatters.bold('Δ:')} ${formatDecimalNumber(totalWeight - totalWeightOffet)} [ ${formatDecimalNumber(
					weight - weightOffset,
				)} + ${formatDecimalNumber(overflow - overflowOffset)} ]
				`,
				inline: true,
			},
		);

		embeds.push(MessageEmbedUtil.padFields(embed));

		return InteractionUtil.reply(interaction, { embeds });
	}
}
