import { SlashCommandBuilder } from 'discord.js';
import BaseSkyBlockCommand, { type FetchedData } from './~base-skyblock-command.js';
import { hypixel } from '#api';
import { SKILLS, SKILL_ACHIEVEMENTS, SKILL_XP_TOTAL, UnicodeEmoji } from '#constants';
import {
	formatDecimalNumber,
	getSkillLevel,
	isSkillAPIEnabled,
	seconds,
	shortenNumber,
	upperCaseFirstChar,
} from '#functions';
import { toUpperCase } from '#lib/types/util.js';
import type { CommandContext } from '#structures/commands/BaseCommand.js';

export default class SkillsCommand extends BaseSkyBlockCommand {
	public constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder().setDescription("shows a player's skills"),
			cooldown: seconds(1),
		});
	}

	/**
	 * data -> reply
	 *
	 * @param data
	 */
	protected override async _generateReply({ ign, uuid, profile }: FetchedData) {
		const member = profile.members[uuid]!;
		const reply = ['']; // first element will be replaced later

		let totalXp = 0;
		let totalLevel = 0;

		if (isSkillAPIEnabled(member)) {
			for (const skill of SKILLS) {
				const XP = member.player_data?.experience?.[`SKILL_${toUpperCase(skill)}`] ?? 0;
				const { progressLevel, nonFlooredLevel } = getSkillLevel(skill, XP, 60);

				totalXp += XP;
				totalLevel += nonFlooredLevel;

				reply.push(`${upperCaseFirstChar(skill)} ${progressLevel}`);
			}
		} else {
			// API disabled -> get level from achievements
			const { player } = await hypixel.player.uuid(uuid);

			if (player?.achievements) {
				for (const skill of SKILLS) {
					const XP = SKILL_XP_TOTAL[player.achievements[SKILL_ACHIEVEMENTS[skill]] ?? 0] ?? 0;
					const { progressLevel, nonFlooredLevel } = getSkillLevel(skill, XP, 60);

					totalXp += XP;
					totalLevel += nonFlooredLevel;

					reply.push(`${upperCaseFirstChar(skill)} ${progressLevel}`);
				}
			}

			reply.push(`${UnicodeEmoji.X} API disabled`);
		}

		reply[0] = `${formatDecimalNumber(totalLevel / SKILLS.length)} Skill Average (${shortenNumber(totalXp)} Total XP)`;

		return { ign, profile, reply };
	}
}
