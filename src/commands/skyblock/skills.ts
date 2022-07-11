import { SlashCommandBuilder } from 'discord.js';
import { SKILLS, SKILL_ACHIEVEMENTS, SKILL_XP_TOTAL, UnicodeEmoji } from '#constants';
import { formatDecimalNumber, getSkillLevel, seconds, shortenNumber, upperCaseFirstChar } from '#functions';
import { hypixel } from '#api';
import BaseSkyBlockCommand from './~base-skyblock-command';
import type { FetchedData } from './~base-skyblock-command';
import type { CommandContext } from '#structures/commands/BaseCommand';

export default class SkillsCommand extends BaseSkyBlockCommand {
	constructor(context: CommandContext) {
		super(
			context,
			{
				slash: new SlashCommandBuilder().setDescription("shows a player's skills"),
				cooldown: seconds(1),
			},
			{
				aliases: [],
			},
		);
	}

	/**
	 * data -> reply
	 * @param data
	 */
	override async _generateReply({ ign, uuid, profile }: FetchedData) {
		const member = profile.members[uuid]!;
		const reply = [`${ign} (${profile.cute_name}): `];

		let totalXp = 0;
		let totalLevel = 0;

		if (Reflect.has(member, 'experience_skill_mining')) {
			for (const skill of SKILLS) {
				const XP = member[`experience_skill_${skill}`] ?? 0;
				const { progressLevel, nonFlooredLevel } = getSkillLevel(skill, XP, 60);

				totalXp += XP;
				totalLevel += nonFlooredLevel;

				reply.push(`${upperCaseFirstChar(skill)} ${progressLevel}`);
			}
		} else {
			// API disabled -> get level from achievements
			const { achievements } = await hypixel.player.uuid(uuid);

			for (const skill of SKILLS) {
				const XP = SKILL_XP_TOTAL[achievements?.[SKILL_ACHIEVEMENTS[skill]] ?? 0] ?? 0;
				const { progressLevel, nonFlooredLevel } = getSkillLevel(skill, XP, 60);

				totalXp += XP;
				totalLevel += nonFlooredLevel;

				reply.push(`${upperCaseFirstChar(skill)} ${progressLevel}`);
			}

			reply.push(`${UnicodeEmoji.X} API disabled`);
		}

		reply[0] += `${formatDecimalNumber(totalLevel / SKILLS.length)} Skill Average (${shortenNumber(totalXp)} Total XP)`;

		return reply.join(' | ');
	}
}
