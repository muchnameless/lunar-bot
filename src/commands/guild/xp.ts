import { stripIndents } from 'common-tags';
import {
	bold,
	codeBlock,
	EmbedBuilder,
	SlashCommandBuilder,
	time,
	type APIEmbed,
	type ChatInputCommandInteraction,
	type JSONEncodable,
} from 'discord.js';
import {
	COSMETIC_SKILLS,
	DUNGEON_TYPES_AND_CLASSES,
	SKILLS,
	SLAYERS,
	XP_OFFSETS_CONVERTER,
	XP_OFFSETS_TIME,
	type XPOffsets,
} from '#constants';
import { formatDecimalNumber, formatNumber, getDefaultOffset, seconds, upperCaseFirstChar } from '#functions';
import { ApplicationCommand } from '#structures/commands/ApplicationCommand.js';
import type { CommandContext } from '#structures/commands/BaseCommand.js';
import { optionalPlayerOption, pageOption, offsetOption } from '#structures/commands/commonOptions.js';
import { EmbedUtil, InteractionUtil } from '#utils';

export default class XpCommand extends ApplicationCommand {
	public constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder()
				.setDescription("check a player's xp gained")
				.addStringOption(optionalPlayerOption)
				.addIntegerOption(pageOption)
				.addStringOption(offsetOption)
				.addBooleanOption((option) =>
					option //
						.setName('update')
						.setDescription('update xp before running the command')
						.setRequired(false),
				),
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 */
	public override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		const player = InteractionUtil.getPlayer(interaction, { fallbackToCurrentUser: true, throwIfNotFound: true });
		const OFFSET = (interaction.options.getString('offset') as XPOffsets) ?? getDefaultOffset(this.config);

		// update db?
		if (interaction.options.getBoolean('update')) await player.updateXp();

		const embeds: JSONEncodable<APIEmbed>[] = [];
		const { skillAverage, trueAverage } = player.getSkillAverage();
		const { skillAverage: skillAverageOffset, trueAverage: trueAverageOffset } = player.getSkillAverage(OFFSET);

		let embed = new EmbedBuilder()
			.setColor(this.config.get('EMBED_BLUE'))
			.setAuthor({
				name: `${player}${player.mainProfileName ? ` (${player.mainProfileName})` : ''}`,
				iconURL: player.imageURL,
				url: player.url,
			})
			.setDescription(
				`${`Δ: change since ${time(
					seconds.fromMilliseconds(
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
						${codeBlock('Skills')}
							Average skill level: ${bold(formatDecimalNumber(skillAverage))} [${bold(formatDecimalNumber(trueAverage))}] - ${bold(
					'Δ',
				)}: ${bold(formatDecimalNumber(skillAverage - skillAverageOffset))} [${bold(
					formatDecimalNumber(trueAverage - trueAverageOffset),
				)}]`,
			});

		// skills
		for (const skill of SKILLS) {
			const SKILL_ARGUMENT = `${skill}Xp` as const;
			const OFFSET_ARGUMENT = `${skill}Xp${OFFSET}` as const;
			const { progressLevel } = player.getSkillLevel(skill);

			embed.addFields({
				name: upperCaseFirstChar(skill),
				value: stripIndents`
					${bold('Lvl:')} ${progressLevel}
					${bold('XP:')} ${formatNumber(Math.round(player[SKILL_ARGUMENT]))}
					${bold('Δ:')} ${formatNumber(Math.round(player[SKILL_ARGUMENT] - player[OFFSET_ARGUMENT]))}
				`,
				inline: true,
			});
		}

		EmbedUtil.padFields(embed);

		for (const skill of COSMETIC_SKILLS) {
			const SKILL_ARGUMENT = `${skill}Xp` as const;
			const { progressLevel } = player.getSkillLevel(skill);

			embed.addFields({
				name: upperCaseFirstChar(skill),
				value: stripIndents`
					${bold('Lvl:')} ${progressLevel}
					${bold('XP:')} ${formatNumber(Math.round(player[SKILL_ARGUMENT]))}
					${bold('Δ:')} ${formatNumber(Math.round(player[SKILL_ARGUMENT] - player[`${skill}Xp${OFFSET}`]))}
				`,
				inline: true,
			});
		}

		EmbedUtil.padFields(embed);

		// slayer
		const TOTAL_SLAYER_XP = player.getSlayerTotal();

		embed.addFields({
			name: '\u200B',
			value: stripIndents`
				${codeBlock('Slayer')}
				Total slayer xp: ${bold(formatNumber(TOTAL_SLAYER_XP))} - ${bold('Δ')}: ${bold(
				formatNumber(TOTAL_SLAYER_XP - player.getSlayerTotal(OFFSET)),
			)}`,
			inline: false,
		});

		for (const slayer of SLAYERS) {
			const SLAYER_ARGUMENT = `${slayer}Xp` as const;

			embed.addFields({
				name: upperCaseFirstChar(slayer),
				value: stripIndents`
					${bold('Lvl:')} ${player.getSlayerLevel(slayer)}
					${bold('XP:')} ${formatNumber(player[SLAYER_ARGUMENT])}
					${bold('Δ:')} ${formatNumber(Math.round(player[SLAYER_ARGUMENT] - player[`${slayer}Xp${OFFSET}`]))}
				`,
				inline: true,
			});
		}

		embeds.push(EmbedUtil.padFields(embed));

		embed = this.client.defaultEmbed
			.setDescription(`\u200B${''.padEnd(171, '\u00A0')}\u200B\n${codeBlock('Dungeons')}`)
			.setFooter({ text: '\u200B\nUpdated at' })
			.setTimestamp(player.xpLastUpdatedAt);

		// dungeons
		for (const type of DUNGEON_TYPES_AND_CLASSES) {
			const DUNGEON_ARGUMENT = `${type}Xp` as const;
			const { progressLevel } = player.getSkillLevel(type);

			embed.addFields({
				name: upperCaseFirstChar(type),
				value: stripIndents`
					${bold('Lvl:')} ${progressLevel}
					${bold('XP:')} ${formatNumber(Math.round(player[DUNGEON_ARGUMENT]))}
					${bold('Δ:')} ${formatNumber(Math.round(player[DUNGEON_ARGUMENT] - player[`${type}Xp${OFFSET}`]))}
				`,
				inline: true,
			});
		}

		const { totalWeight, weight, overflow } = player.getLilyWeight();
		const {
			totalWeight: totalWeightOffset,
			weight: weightOffset,
			overflow: overflowOffset,
		} = player.getLilyWeight(OFFSET);

		EmbedUtil.padFields(embed).addFields(
			{
				name: '\u200B',
				value: `${codeBlock('Miscellaneous')}\u200B`,
				inline: false,
			},
			{
				name: 'Hypixel Guild XP',
				value: stripIndents`
					${bold('Total:')} ${formatNumber(player.guildXp)}
					${bold('Δ:')} ${formatNumber(player.guildXp - player[`guildXp${OFFSET}`])}
				`,
				inline: true,
			},
			{
				name: 'Lily Weight',
				value: stripIndents`
					${bold('Total')}: ${formatDecimalNumber(totalWeight)} [ ${formatDecimalNumber(weight)} + ${formatDecimalNumber(
					overflow,
				)} ]
					${bold('Δ:')} ${formatDecimalNumber(totalWeight - totalWeightOffset)} [ ${formatDecimalNumber(
					weight - weightOffset,
				)} + ${formatDecimalNumber(overflow - overflowOffset)} ]
				`,
				inline: true,
			},
		);

		embeds.push(EmbedUtil.padFields(embed));

		return InteractionUtil.reply(interaction, { embeds });
	}
}
