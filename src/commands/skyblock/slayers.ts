import { SlashCommandBuilder } from 'discord.js';
import BaseSkyBlockCommand, { type FetchedData } from './~base-skyblock-command.js';
import { SLAYERS } from '#constants';
import { getSlayerLevel, seconds, shortenNumber, upperCaseFirstChar } from '#functions';
import type { CommandContext } from '#structures/commands/BaseCommand.js';

export default class SlayersCommand extends BaseSkyBlockCommand {
	public constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder().setDescription("shows a player's slayer stats"),
			cooldown: seconds(1),
		});
	}

	/**
	 * data -> reply
	 *
	 * @param data
	 */
	protected override _generateReply({ ign, uuid, profile }: FetchedData) {
		const member = profile.members[uuid]!;
		const reply: string[] = [null!];

		let totalXp = 0;

		for (const slayer of SLAYERS) {
			const XP = member.slayer_bosses?.[slayer]?.xp ?? 0;

			totalXp += XP;

			reply.push(`${upperCaseFirstChar(slayer)} ${getSlayerLevel(XP)} (${shortenNumber(XP)} XP)`);
		}

		reply[0] = `${shortenNumber(totalXp)} Slayer XP`;

		return { ign, profile, reply: reply.join(' | ') };
	}
}
