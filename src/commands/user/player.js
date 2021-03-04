'use strict';

const { MessageEmbed } = require('discord.js');
const { oneLine, stripIndents } = require('common-tags');
const { SKILLS, /* COSMETIC_SKILLS, */ SLAYERS, DUNGEON_TYPES, DUNGEON_CLASSES } = require('../../constants/skyblock');
const { offsetFlags, XP_OFFSETS_TIME, XP_OFFSETS_CONVERTER } = require('../../constants/database');
const { /* escapeIgn, */ upperCaseFirstChar, autocorrectToOffset } = require('../../functions/util');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class PlayerCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'xp' ],
			description: 'check a player\'s xp gained',
			usage: '<`IGN` to check someone other than yourself>',
			cooldown: 1,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(message, args, flags, rawArgs) {
		// type input
		const offsetInput = args.map((arg, index) => ({ index, ...autocorrectToOffset(arg) })).sort((a, b) => a.similarity - b.similarity).pop();
		const offset = offsetInput?.similarity >= this.client.config.get('AUTOCORRECT_THRESHOLD')
			? (() => {
				args.splice(offsetInput.index, 1);
				return offsetInput.value;
			})()
			: (this.client.config.getBoolean('COMPETITION_RUNNING') || (Date.now() - this.client.config.get('COMPETITION_END_TIME') >= 0 && Date.now() - this.client.config.get('COMPETITION_END_TIME') <= 24 * 60 * 60 * 1000)
				? offsetFlags.COMPETITION_START
				: this.client.config.get('DEFAULT_XP_OFFSET')
			);

		// player input
		/**
		 * @type {import('../../structures/database/models/Player')}
		 */
		const player = message.mentions.users.size
			? message.mentions.users.first().player
			: (() => {
				const playerInput = args.map(arg => this.client.players.autocorrectToPlayer(arg)).sort((a, b) => a.similarity - b.similarity).pop();

				return playerInput?.similarity >= this.client.config.get('AUTOCORRECT_THRESHOLD')
					? playerInput.value
					: message.author.player;
			})();

		if (!player) {
			return message.reply(oneLine`${message.mentions.users.size
				? `\`${message.guild
					? message.mentions.members.first().displayName
					: message.mentions.users.first().username}\`
					 is`
				: 'you are'
			} not in the player db.`);
		}

		// update db?
		if (flags.some(flag => [ 'f', 'force' ].includes(flag))) await player.updateXp({ shouldSkipQueue: true });

		const startingDate = new Date(Math.max(this.client.config.getNumber(XP_OFFSETS_TIME[offset]), player.createdAt.getTime()));
		const embed = new MessageEmbed()
			.setColor(this.client.config.get('EMBED_BLUE'))
			.setAuthor(`${player.ign}${player.mainProfileName ? ` (${player.mainProfileName})` : ''}`, player.image, player.url)
			// .setTitle(`${escapeIgn(player.ign)}${player.mainProfileName ? ` (${player.mainProfileName})` : ''}`)
			// .setURL(player.url)
			// .setThumbnail(player.image)
			.setFooter('\u200b\nUpdated at')
			.setTimestamp(new Date(Number(player.xpLastUpdatedAt)));
		const { skillAverage, trueAverage } = player.getSkillAverage();
		const { skillAverage: skillAverageOffset, trueAverage: trueAverageOffset } = player.getSkillAverage(offset);

		// skills
		SKILLS.forEach(skill => {
			const SKILL_ARGUMENT = `${skill}Xp`;
			const OFFSET_ARGUMENT = `${skill}Xp${offset}`;
			const { progressLevel } = player.getSkillLevel(skill);

			embed.addField(upperCaseFirstChar(skill), stripIndents`
				**LvL:** ${progressLevel}
				**XP:** ${this.client.formatNumber(player[SKILL_ARGUMENT], 0, Math.round)}
				**Δ:** ${this.client.formatNumber(player[SKILL_ARGUMENT] - player[OFFSET_ARGUMENT], 0, Math.round)}
			`, true);
		});

		const TOTAL_SLAYER_XP = player.getSlayerTotal();

		embed
			.setDescription(stripIndents`
				${`Δ: change since ${startingDate.toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} GMT (${upperCaseFirstChar(XP_OFFSETS_CONVERTER[offset])})`.padEnd(105, '\xa0') + '\u200b'}
				
				\`\`\`Skills\`\`\`
				Average skill level: **${this.client.formatDecimalNumber(skillAverage, 0)}** [**${this.client.formatDecimalNumber(trueAverage, 0)}**] - **Δ**: **${this.client.formatDecimalNumber(skillAverage - skillAverageOffset, 0)}** [**${this.client.formatDecimalNumber(trueAverage - trueAverageOffset, 0)}**]
			`)
			.padFields()
			.addField('\u200b', stripIndents`
				\`\`\`Slayer\`\`\`
				Total slayer xp: **${this.client.formatNumber(TOTAL_SLAYER_XP)}** - **Δ**: **${this.client.formatNumber(TOTAL_SLAYER_XP - player.getSlayerTotal(offset))}**
			`, false);

		// slayer
		SLAYERS.forEach(slayer => {
			const SLAYER_ARGUMENT = `${slayer}Xp`;

			embed.addField(upperCaseFirstChar(slayer), stripIndents`
				**LvL:** ${player.getSlayerLevel(slayer)}
				**XP:** ${this.client.formatNumber(player[SLAYER_ARGUMENT])}
				**Δ:** ${this.client.formatNumber(player[SLAYER_ARGUMENT] - player[`${slayer}Xp${offset}`], 0, Math.round)}
			`, true);
		});

		embed
			.padFields()
			.addField('\u200b', '```Dungeons```\u200b', false);

		const DUNGEONS = [ ...DUNGEON_TYPES, ...DUNGEON_CLASSES ];

		// dungeons
		DUNGEONS.forEach(type => {
			const DUNGEON_ARGUMENT = `${type}Xp`;
			const { progressLevel } = player.getSkillLevel(type);

			embed.addField(upperCaseFirstChar(type), stripIndents`
				**LvL:** ${progressLevel}
				**XP:** ${this.client.formatNumber(player[DUNGEON_ARGUMENT], 0, Math.round)}
				**Δ:** ${this.client.formatNumber(player[DUNGEON_ARGUMENT] - player[`${type}Xp${offset}`], 0, Math.round)}
			`, true);
		});

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
			);
		// .padFields();

		// COSMETIC_SKILLS.forEach(skill => {
		// 	const SKILL_ARGUMENT = `${skill}Xp`;
		// 	const { progressLevel } = player.getSkillLevel(skill);

		// 	embed.addField(upperCaseFirstChar(skill), stripIndents`
		// 		**LvL:** ${progressLevel}
		// 		**XP:** ${this.client.formatNumber(player[SKILL_ARGUMENT], 0, Math.round)}
		// 		**Δ:** ${this.client.formatNumber(player[SKILL_ARGUMENT] - player[`${skill}Xp${offset}`], 0, Math.round)}
		// 	`, true);
		// });

		message.reply(embed /* .padFields() */);
	}
};
