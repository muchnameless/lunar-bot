'use strict';

const { MessageEmbed } = require('discord.js');
const { oneLine, stripIndents } = require('common-tags');
const { SKILLS, /* COSMETIC_SKILLS, */ SLAYERS, DUNGEON_TYPES, DUNGEON_CLASSES } = require('../../constants/skyblock');
const { offsetFlags, XP_OFFSETS_TIME } = require('../../constants/database');
const { /* escapeIgn, */ upperCaseFirstChar } = require('../../functions/util');
const { getOffsetFromFlags } = require('../../functions/leaderboardMessages');
const Command = require('../../structures/Command');
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

	async run(client, config, message, args, flags, rawArgs) {
		const { players } = client;
		const player = message.mentions.users.size
			? players.getByID(message.mentions.users.first().id)
			: args.length
				? players.getByIGN(args[0])
				: players.getByID(message.author.id);

		if (!player) {
			return message.reply(oneLine`${message.mentions.users.size
				? `\`${message.guild
					? message.mentions.members.first().displayName
					: message.mentions.users.first().username}\`
					 is`
				: args.length
					? `\`${args[0]}\` is`
					: 'you are'
			} not in the player db.`);
		}

		// update db?
		if (flags.some(flag => [ 'f', 'force' ].includes(flag))) await player.updateXp({ shouldSkipQueue: true });

		const offset = getOffsetFromFlags(config, flags) ?? (config.getBoolean('COMPETITION_RUNNING') || (Date.now() - config.get('COMPETITION_END_TIME') >= 0 && Date.now() - config.get('COMPETITION_END_TIME') <= 24 * 60 * 60 * 1000)
			? offsetFlags.COMPETITION_START
			: config.get('DEFAULT_XP_OFFSET'));
		const startingDate = new Date(Math.max(config.getNumber(XP_OFFSETS_TIME[offset]), player.createdAt.getTime()));
		const embed = new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
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
				**XP:** ${client.formatNumber(player[SKILL_ARGUMENT], 0, Math.round)}
				**Δ:** ${client.formatNumber(player[SKILL_ARGUMENT] - player[OFFSET_ARGUMENT], 0, Math.round)}
			`, true);
		});

		const TOTAL_SLAYER_XP = player.getSlayerTotal();

		embed
			.setDescription(stripIndents`
				${`Δ: change since ${startingDate.toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} GMT`/* .replace(/ /g, '\xa0') */.padEnd(105, '\xa0') + '\u200b'}
				
				\`\`\`Skills\`\`\`
				Average skill level: **${client.formatDecimalNumber(skillAverage, 0)}** [**${client.formatDecimalNumber(trueAverage, 0)}**] - **Δ**: **${client.formatDecimalNumber(skillAverage - skillAverageOffset, 0)}** [**${client.formatDecimalNumber(trueAverage - trueAverageOffset, 0)}**]
			`)
			.padFields()
			.addField('\u200b', stripIndents`
				\`\`\`Slayer\`\`\`
				Total slayer xp: **${client.formatNumber(TOTAL_SLAYER_XP)}** - **Δ**: **${client.formatNumber(TOTAL_SLAYER_XP - player.getSlayerTotal(offset))}**
			`, false);

		// slayer
		SLAYERS.forEach(slayer => {
			const SLAYER_ARGUMENT = `${slayer}Xp`;

			embed.addField(upperCaseFirstChar(slayer), stripIndents`
				**LvL:** ${player.getSlayerLevel(slayer)}
				**XP:** ${client.formatNumber(player[SLAYER_ARGUMENT])}
				**Δ:** ${client.formatNumber(player[SLAYER_ARGUMENT] - player[`${slayer}Xp${offset}`], 0, Math.round)}
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
				**XP:** ${client.formatNumber(player[DUNGEON_ARGUMENT], 0, Math.round)}
				**Δ:** ${client.formatNumber(player[DUNGEON_ARGUMENT] - player[`${type}Xp${offset}`], 0, Math.round)}
			`, true);
		});

		const { totalWeight, weight, overflow } = player.getWeight();
		const { totalWeight: totalWeightOffet, weight: weightOffset, overflow: overflowOffset } = player.getWeight(offset);

		embed
			.padFields()
			.addFields(
				{ name: '\u200b', value: '```Miscellaneous```\u200b', inline: false },
				{ name: 'Hypixel Guild XP', value: stripIndents`
					**Total:** ${client.formatNumber(player.guildXp)}
					**Δ:** ${client.formatNumber(player.guildXp - player[`guildXp${offset}`])}
				`, inline: true },
				{ name: 'Weight', value: stripIndents`
					**Total**: ${client.formatDecimalNumber(totalWeight)} [ ${client.formatDecimalNumber(weight)} + ${client.formatDecimalNumber(overflow)} ]
					**Δ:** ${client.formatDecimalNumber(totalWeight - totalWeightOffet)} [ ${client.formatDecimalNumber(weight - weightOffset)} + ${client.formatDecimalNumber(overflow - overflowOffset)} ]
				`, inline: true },
			);
		// .padFields();

		// COSMETIC_SKILLS.forEach(skill => {
		// 	const SKILL_ARGUMENT = `${skill}Xp`;
		// 	const { progressLevel } = player.getSkillLevel(skill);

		// 	embed.addField(upperCaseFirstChar(skill), stripIndents`
		// 		**LvL:** ${progressLevel}
		// 		**XP:** ${client.formatNumber(player[SKILL_ARGUMENT], 0, Math.round)}
		// 		**Δ:** ${client.formatNumber(player[SKILL_ARGUMENT] - player[`${skill}Xp${offset}`], 0, Math.round)}
		// 	`, true);
		// });

		message.reply(embed /* .padFields() */);
	}
};
