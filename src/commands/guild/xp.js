'use strict';

const { MessageEmbed, Formatters, Constants } = require('discord.js');
const { oneLine, stripIndents } = require('common-tags');
const { skills, cosmeticSkills, slayers, dungeonTypes, dungeonClasses } = require('../../constants/skyblock');
const { XP_OFFSETS_TIME, XP_OFFSETS_CONVERTER, XP_OFFSETS_SHORT } = require('../../constants/database');
const { /* escapeIgn, */ upperCaseFirstChar } = require('../../functions/util');
const { getDefaultOffset } = require('../../functions/leaderboards');
const SlashCommand = require('../../structures/commands/SlashCommand');
// const logger = require('../../functions/logger');


module.exports = class XpCommand extends SlashCommand {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'check a player\'s xp gained',
			options: [{
				name: 'player',
				type: Constants.ApplicationCommandOptionTypes.STRING,
				description: 'IGN | UUID | discord ID | @mention',
				required: false,
			}, {
				name: 'offset',
				type: Constants.ApplicationCommandOptionTypes.STRING,
				description: 'Δ offset',
				required: false,
				choices: Object.keys(XP_OFFSETS_SHORT).map(x => ({ name: x, value: XP_OFFSETS_CONVERTER[x] })),
			}, {
				name: 'update',
				type: Constants.ApplicationCommandOptionTypes.BOOLEAN,
				description: 'update xp before running the command',
				required: false,
			}],
			defaultPermission: true,
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) {
		const offset = interaction.options.getString('offset') ?? getDefaultOffset(this.config);
		const player = this.getPlayer(interaction, true);

		if (!player) {
			return interaction.reply(oneLine`${interaction.options.get('player')
				? `\`${interaction.options.getString('player')}\` is`
				: 'you are'
			} not in the player db`);
		}

		// update db?
		if (interaction.options.getBoolean('update')) {
			interaction.defer(); // update may take a while
			await player.updateXp();
		}

		const embeds = [];
		const { skillAverage, trueAverage } = player.getSkillAverage();
		const { skillAverage: skillAverageOffset, trueAverage: trueAverageOffset } = player.getSkillAverage(offset);

		let embed = new MessageEmbed()
			.setColor(this.config.get('EMBED_BLUE'))
			.setAuthor(`${player.ign}${player.mainProfileName ? ` (${player.mainProfileName})` : ''}`, player.image, player.url)
			// .setTitle(`${escapeIgn(player.ign)}${player.mainProfileName ? ` (${player.mainProfileName})` : ''}`)
			// .setURL(player.url)
			// .setThumbnail(player.image)
			.setDescription(`${`Δ: change since ${Formatters.time(new Date(Math.max(this.config.get(XP_OFFSETS_TIME[offset]), player.createdAt)))} (${upperCaseFirstChar(XP_OFFSETS_CONVERTER[offset])})`.padEnd(105, '\xa0')}\u200b`)
			.addFields({
				name: '\u200b',
				value: stripIndents`
					${Formatters.codeBlock('Skills')}
					Average skill level: ${Formatters.bold(this.client.formatDecimalNumber(skillAverage))} [${Formatters.bold(this.client.formatDecimalNumber(trueAverage))}] - ${Formatters.bold('Δ')}: ${Formatters.bold(this.client.formatDecimalNumber(skillAverage - skillAverageOffset))} [${Formatters.bold(this.client.formatDecimalNumber(trueAverage - trueAverageOffset))}]
				`,
			});

		// skills
		for (const skill of skills) {
			const SKILL_ARGUMENT = `${skill}Xp`;
			const OFFSET_ARGUMENT = `${skill}Xp${offset}`;
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

		embed.padFields();

		for (const skill of cosmeticSkills) {
			const SKILL_ARGUMENT = `${skill}Xp`;
			const { progressLevel } = player.getSkillLevel(skill);

			embed.addFields({
				name: upperCaseFirstChar(skill),
				value: stripIndents`
					${Formatters.bold('Lvl:')} ${progressLevel}
					${Formatters.bold('XP:')} ${this.client.formatNumber(player[SKILL_ARGUMENT], 0, Math.round)}
					${Formatters.bold('Δ:')} ${this.client.formatNumber(player[SKILL_ARGUMENT] - player[`${skill}Xp${offset}`], 0, Math.round)}
				`,
				inline: true,
			});
		}

		embed.padFields();

		// slayer
		const TOTAL_SLAYER_XP = player.getSlayerTotal();

		embed.addFields({
			name: '\u200b',
			value: stripIndents`
				${Formatters.codeBlock('Slayer')}
				Total slayer xp: ${Formatters.bold(this.client.formatNumber(TOTAL_SLAYER_XP))} - ${Formatters.bold('Δ')}: ${Formatters.bold(this.client.formatNumber(TOTAL_SLAYER_XP - player.getSlayerTotal(offset)))}
			`,
			inline: false,
		});

		for (const slayer of slayers) {
			const SLAYER_ARGUMENT = `${slayer}Xp`;

			embed.addFields({
				name: upperCaseFirstChar(slayer),
				value: stripIndents`
					${Formatters.bold('Lvl:')} ${player.getSlayerLevel(slayer)}
					${Formatters.bold('XP:')} ${this.client.formatNumber(player[SLAYER_ARGUMENT])}
					${Formatters.bold('Δ:')} ${this.client.formatNumber(player[SLAYER_ARGUMENT] - player[`${slayer}Xp${offset}`], 0, Math.round)}
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
		for (const type of [ ...dungeonTypes, ...dungeonClasses ]) {
			const DUNGEON_ARGUMENT = `${type}Xp`;
			const { progressLevel } = player.getSkillLevel(type);

			embed.addFields({
				name: upperCaseFirstChar(type),
				value: stripIndents`
					${Formatters.bold('Lvl:')} ${progressLevel}
					${Formatters.bold('XP:')} ${this.client.formatNumber(player[DUNGEON_ARGUMENT], 0, Math.round)}
					${Formatters.bold('Δ:')} ${this.client.formatNumber(player[DUNGEON_ARGUMENT] - player[`${type}Xp${offset}`], 0, Math.round)}
				`,
				inline: true,
			});
		}

		const { totalWeight, weight, overflow } = player.getWeight();
		const { totalWeight: totalWeightOffet, weight: weightOffset, overflow: overflowOffset } = player.getWeight(offset);

		embed
			.padFields()
			.addFields({
				name: '\u200b',
				value: `${Formatters.codeBlock('Miscellaneous')}\u200b`,
				inline: false,
			}, {
				name: 'Hypixel Guild XP',
				value: stripIndents`
					${Formatters.bold('Total:')} ${this.client.formatNumber(player.guildXp)}
					${Formatters.bold('Δ:')} ${this.client.formatNumber(player.guildXp - player[`guildXp${offset}`])}
				`,
				inline: true,
			}, {
				name: 'Weight',
				value: stripIndents`
					${Formatters.bold('Total')}: ${this.client.formatDecimalNumber(totalWeight)} [ ${this.client.formatDecimalNumber(weight)} + ${this.client.formatDecimalNumber(overflow)} ]
					${Formatters.bold('Δ:')} ${this.client.formatDecimalNumber(totalWeight - totalWeightOffet)} [ ${this.client.formatDecimalNumber(weight - weightOffset)} + ${this.client.formatDecimalNumber(overflow - overflowOffset)} ]
				`,
				inline: true,
			})
			.padFields();

		embeds.push(embed);

		return interaction.reply({ embeds });
	}
};
