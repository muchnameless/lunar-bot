'use strict';

const { Constants } = require('discord.js');
const { oneLine, stripIndents } = require('common-tags');
const { skills, cosmeticSkills, slayers, dungeonTypes, dungeonClasses } = require('../../constants/skyblock');
const { offsetFlags, XP_OFFSETS_TIME, XP_OFFSETS_CONVERTER, XP_OFFSETS_SHORT } = require('../../constants/database');
const { /* escapeIgn, */ upperCaseFirstChar } = require('../../functions/util');
const SlashCommand = require('../../structures/commands/SlashCommand');
// const logger = require('../../functions/logger');


module.exports = class XpCommand extends SlashCommand {
	/**
	 * @param {import('../../structures/commands/SlashCommand').CommandData} commandData
	 */
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'check a player\'s xp gained',
			options: [{
				name: 'player',
				type: Constants.ApplicationCommandOptionTypes.STRING,
				description: 'IGN | minecraftUUID | discordID | @mention',
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
	async run(interaction) { // eslint-disable-line no-unused-vars
		const offset = interaction.options.get('offset')?.value
			?? (this.config.getBoolean('COMPETITION_RUNNING') || (Date.now() - this.config.get('COMPETITION_END_TIME') >= 0 && Date.now() - this.config.get('COMPETITION_END_TIME') <= 24 * 60 * 60 * 1000)
				? offsetFlags.COMPETITION_START
				: this.config.get('DEFAULT_XP_OFFSET')
			);
		const player = this.getPlayer(interaction.options, interaction);

		if (!player) {
			return interaction.reply(oneLine`${interaction.options.has('player')
				? `\`${interaction.options.get('player').value}\` is`
				: 'you are'
			} not in the player db.`);
		}

		// update db?
		if (interaction.options.get('force')) {
			interaction.defer(); // update may take a while
			await player.updateXp();
		}

		const startingDate = new Date(Math.max(this.config.getNumber(XP_OFFSETS_TIME[offset]), player.createdAt.getTime()));
		const embeds = [];

		let embed = this.client.defaultEmbed
			.setAuthor(`${player.ign}${player.mainProfileName ? ` (${player.mainProfileName})` : ''}`, player.image, player.url);
			// .setTitle(`${escapeIgn(player.ign)}${player.mainProfileName ? ` (${player.mainProfileName})` : ''}`)
			// .setURL(player.url)
			// .setThumbnail(player.image)
		const { skillAverage, trueAverage } = player.getSkillAverage();
		const { skillAverage: skillAverageOffset, trueAverage: trueAverageOffset } = player.getSkillAverage(offset);

		// skills
		for (const skill of skills) {
			const SKILL_ARGUMENT = `${skill}Xp`;
			const OFFSET_ARGUMENT = `${skill}Xp${offset}`;
			const { progressLevel } = player.getSkillLevel(skill);

			embed.addField(upperCaseFirstChar(skill), stripIndents`
				**LvL:** ${progressLevel}
				**XP:** ${this.client.formatNumber(player[SKILL_ARGUMENT], 0, Math.round)}
				**Δ:** ${this.client.formatNumber(player[SKILL_ARGUMENT] - player[OFFSET_ARGUMENT], 0, Math.round)}
			`, true);
		}

		embed.padFields();

		for (const skill of cosmeticSkills) {
			const SKILL_ARGUMENT = `${skill}Xp`;
			const { progressLevel } = player.getSkillLevel(skill);

			embed.addField(upperCaseFirstChar(skill), stripIndents`
				**LvL:** ${progressLevel}
				**XP:** ${this.client.formatNumber(player[SKILL_ARGUMENT], 0, Math.round)}
				**Δ:** ${this.client.formatNumber(player[SKILL_ARGUMENT] - player[`${skill}Xp${offset}`], 0, Math.round)}
			`, true);
		}

		const TOTAL_SLAYER_XP = player.getSlayerTotal();

		embed
			.setDescription(stripIndents`
				${`Δ: change since ${startingDate.toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} GMT (${upperCaseFirstChar(XP_OFFSETS_CONVERTER[offset])})`.padEnd(105, '\xa0')}\u200b
				
				\`\`\`Skills\`\`\`
				Average skill level: **${this.client.formatDecimalNumber(skillAverage)}** [**${this.client.formatDecimalNumber(trueAverage)}**] - **Δ**: **${this.client.formatDecimalNumber(skillAverage - skillAverageOffset)}** [**${this.client.formatDecimalNumber(trueAverage - trueAverageOffset)}**]
			`)
			.padFields()
			.addField('\u200b', stripIndents`
				\`\`\`Slayer\`\`\`
				Total slayer xp: **${this.client.formatNumber(TOTAL_SLAYER_XP)}** - **Δ**: **${this.client.formatNumber(TOTAL_SLAYER_XP - player.getSlayerTotal(offset))}**
			`, false);

		// slayer
		for (const slayer of slayers) {
			const SLAYER_ARGUMENT = `${slayer}Xp`;

			embed.addField(upperCaseFirstChar(slayer), stripIndents`
				**LvL:** ${player.getSlayerLevel(slayer)}
				**XP:** ${this.client.formatNumber(player[SLAYER_ARGUMENT])}
				**Δ:** ${this.client.formatNumber(player[SLAYER_ARGUMENT] - player[`${slayer}Xp${offset}`], 0, Math.round)}
			`, true);
		}

		embeds.push(embed);

		embed = this.client.defaultEmbed
			.setDescription('```Dungeons```\u200b')
			.setFooter('\u200b\nUpdated at')
			.setTimestamp(player.xpLastUpdatedAt);

		// dungeons
		for (const type of [ ...dungeonTypes, ...dungeonClasses ]) {
			const DUNGEON_ARGUMENT = `${type}Xp`;
			const { progressLevel } = player.getSkillLevel(type);

			embed.addField(upperCaseFirstChar(type), stripIndents`
				**LvL:** ${progressLevel}
				**XP:** ${this.client.formatNumber(player[DUNGEON_ARGUMENT], 0, Math.round)}
				**Δ:** ${this.client.formatNumber(player[DUNGEON_ARGUMENT] - player[`${type}Xp${offset}`], 0, Math.round)}
			`, true);
		}

		const { totalWeight, weight, overflow } = player.getWeight();
		const { totalWeight: totalWeightOffet, weight: weightOffset, overflow: overflowOffset } = player.getWeight(offset);

		embed
			.padFields()
			.addFields(
				{ name: '\u200b', value: '```Miscellaneous```\u200b', inline: false },
				{ name: 'Hypixel Guild XP', value: stripIndents`
					**Total:** ${this.client.formatNumber(player.guildXp)}
					**Δ:** ${this.client.formatNumber(player.guildXp - player[`guildXp${offset}`])}
				`, inline: true },
				{ name: 'Weight', value: stripIndents`
					**Total**: ${this.client.formatDecimalNumber(totalWeight)} [ ${this.client.formatDecimalNumber(weight)} + ${this.client.formatDecimalNumber(overflow)} ]
					**Δ:** ${this.client.formatDecimalNumber(totalWeight - totalWeightOffet)} [ ${this.client.formatDecimalNumber(weight - weightOffset)} + ${this.client.formatDecimalNumber(overflow - overflowOffset)} ]
				`, inline: true },
			)
			.padFields();

		embeds.push(embed);

		return interaction.reply({ embeds });
	}
};
