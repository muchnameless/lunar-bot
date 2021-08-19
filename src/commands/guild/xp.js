import { SlashCommandBuilder } from '@discordjs/builders';
import { MessageEmbed, Formatters } from 'discord.js';
import { oneLine, stripIndents } from 'common-tags';
import { COSMETIC_SKILLS, DUNGEON_TYPES_AND_CLASSES, SKILLS, SLAYERS, XP_OFFSETS_CONVERTER, XP_OFFSETS_TIME } from '../../constants/index.js';
import { optionalPlayerOption, pageOption, offsetOption } from '../../structures/commands/commonOptions.js';
import { InteractionUtil, MessageEmbedUtil } from '../../util/index.js';
import { getDefaultOffset, upperCaseFirstChar } from '../../functions/index.js';
import { SlashCommand } from '../../structures/commands/SlashCommand.js';


export default class XpCommand extends SlashCommand {
	constructor(context) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('check a player\'s xp gained')
				.addStringOption(optionalPlayerOption)
				.addIntegerOption(pageOption)
				.addStringOption(offsetOption)
				.addBooleanOption(option => option
					.setName('update')
					.setDescription('update xp before running the command')
					.setRequired(false),
				),
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async runSlash(interaction) {
		const OFFSET = interaction.options.getString('offset') ?? getDefaultOffset(this.config);
		const player = InteractionUtil.getPlayer(interaction, true);

		if (!player) {
			return await InteractionUtil.reply(interaction, oneLine`${interaction.options.get('player')
				? `\`${interaction.options.getString('player')}\` is`
				: 'you are'
			} not in the player db`);
		}

		// update db?
		if (interaction.options.getBoolean('update')) {
			InteractionUtil.deferReply(interaction); // update may take a while
			await player.updateXp();
		}

		const embeds = [];
		const { skillAverage, trueAverage } = player.getSkillAverage();
		const { skillAverage: skillAverageOffset, trueAverage: trueAverageOffset } = player.getSkillAverage(OFFSET);

		let embed = new MessageEmbed()
			.setColor(this.config.get('EMBED_BLUE'))
			.setAuthor(`${player}${player.mainProfileName ? ` (${player.mainProfileName})` : ''}`, player.image, player.url)
			.setDescription(`${`Δ: change since ${Formatters.time(new Date(Math.max(this.config.get(XP_OFFSETS_TIME[OFFSET]), player.createdAt)))} (${upperCaseFirstChar(XP_OFFSETS_CONVERTER[OFFSET])})`.padEnd(105, '\xa0')}\u200b`)
			.addFields({
				name: '\u200b',
				value: stripIndents`
					${Formatters.codeBlock('SKILLS')}
					Average skill level: ${Formatters.bold(this.client.formatDecimalNumber(skillAverage))} [${Formatters.bold(this.client.formatDecimalNumber(trueAverage))}] - ${Formatters.bold('Δ')}: ${Formatters.bold(this.client.formatDecimalNumber(skillAverage - skillAverageOffset))} [${Formatters.bold(this.client.formatDecimalNumber(trueAverage - trueAverageOffset))}]
				`,
			});

		// skills
		for (const skill of SKILLS) {
			const SKILL_ARGUMENT = `${skill}Xp`;
			const OFFSET_ARGUMENT = `${skill}Xp${OFFSET}`;
			const { progressLevel } = player.getSkillLevel(skill);

			embed.addFields({
				name: upperCaseFirstChar(skill),
				value: stripIndents`
					${Formatters.bold('Lvl:')} ${progressLevel}
					${Formatters.bold('XP:')} ${this.client.formatNumber(player[SKILL_ARGUMENT], 0, Math.round)}
					${Formatters.bold('Δ:')} ${this.client.formatNumber(player[SKILL_ARGUMENT] - player[OFFSET_ARGUMENT], 0, Math.round)}
				`,
				inline: true,
			});
		}

		MessageEmbedUtil.padFields(embed);

		for (const skill of COSMETIC_SKILLS) {
			const SKILL_ARGUMENT = `${skill}Xp`;
			const { progressLevel } = player.getSkillLevel(skill);

			embed.addFields({
				name: upperCaseFirstChar(skill),
				value: stripIndents`
					${Formatters.bold('Lvl:')} ${progressLevel}
					${Formatters.bold('XP:')} ${this.client.formatNumber(player[SKILL_ARGUMENT], 0, Math.round)}
					${Formatters.bold('Δ:')} ${this.client.formatNumber(player[SKILL_ARGUMENT] - player[`${skill}Xp${OFFSET}`], 0, Math.round)}
				`,
				inline: true,
			});
		}

		MessageEmbedUtil.padFields(embed);

		// slayer
		const TOTAL_SLAYER_XP = player.getSlayerTotal();

		embed.addFields({
			name: '\u200b',
			value: stripIndents`
				${Formatters.codeBlock('Slayer')}
				Total slayer xp: ${Formatters.bold(this.client.formatNumber(TOTAL_SLAYER_XP))} - ${Formatters.bold('Δ')}: ${Formatters.bold(this.client.formatNumber(TOTAL_SLAYER_XP - player.getSlayerTotal(OFFSET)))}
			`,
			inline: false,
		});

		for (const slayer of SLAYERS) {
			const SLAYER_ARGUMENT = `${slayer}Xp`;

			embed.addFields({
				name: upperCaseFirstChar(slayer),
				value: stripIndents`
					${Formatters.bold('Lvl:')} ${player.getSlayerLevel(slayer)}
					${Formatters.bold('XP:')} ${this.client.formatNumber(player[SLAYER_ARGUMENT])}
					${Formatters.bold('Δ:')} ${this.client.formatNumber(player[SLAYER_ARGUMENT] - player[`${slayer}Xp${OFFSET}`], 0, Math.round)}
				`,
				inline: true,
			});
		}

		embeds.push(embed);

		embed = this.client.defaultEmbed
			.setDescription(`\u200b${''.padEnd(171, '\xa0')}\u200b\n${Formatters.codeBlock('Dungeons')}`)
			.setFooter('\u200b\nUpdated at')
			.setTimestamp(player.xpLastUpdatedAt);

		// dungeons
		for (const type of DUNGEON_TYPES_AND_CLASSES) {
			const DUNGEON_ARGUMENT = `${type}Xp`;
			const { progressLevel } = player.getSkillLevel(type);

			embed.addFields({
				name: upperCaseFirstChar(type),
				value: stripIndents`
					${Formatters.bold('Lvl:')} ${progressLevel}
					${Formatters.bold('XP:')} ${this.client.formatNumber(player[DUNGEON_ARGUMENT], 0, Math.round)}
					${Formatters.bold('Δ:')} ${this.client.formatNumber(player[DUNGEON_ARGUMENT] - player[`${type}Xp${OFFSET}`], 0, Math.round)}
				`,
				inline: true,
			});
		}

		const { totalWeight, weight, overflow } = player.getSenitherWeight();
		const { totalWeight: totalWeightOffet, weight: weightOffset, overflow: overflowOffset } = player.getSenitherWeight(OFFSET);

		MessageEmbedUtil.padFields(embed)
			.addFields({
				name: '\u200b',
				value: `${Formatters.codeBlock('Miscellaneous')}\u200b`,
				inline: false,
			}, {
				name: 'Hypixel Guild XP',
				value: stripIndents`
					${Formatters.bold('Total:')} ${this.client.formatNumber(player.guildXp)}
					${Formatters.bold('Δ:')} ${this.client.formatNumber(player.guildXp - player[`guildXp${OFFSET}`])}
				`,
				inline: true,
			}, {
				name: 'Weight',
				value: stripIndents`
					${Formatters.bold('Total')}: ${this.client.formatDecimalNumber(totalWeight)} [ ${this.client.formatDecimalNumber(weight)} + ${this.client.formatDecimalNumber(overflow)} ]
					${Formatters.bold('Δ:')} ${this.client.formatDecimalNumber(totalWeight - totalWeightOffet)} [ ${this.client.formatDecimalNumber(weight - weightOffset)} + ${this.client.formatDecimalNumber(overflow - overflowOffset)} ]
				`,
				inline: true,
			});

		embeds.push(MessageEmbedUtil.padFields(embed));

		return await InteractionUtil.reply(interaction, { embeds });
	}
}
