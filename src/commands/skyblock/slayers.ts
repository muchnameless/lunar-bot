import { SlashCommandBuilder } from 'discord.js';
import { SLAYERS } from '#constants';
import { getSlayerLevel, seconds, shortenNumber, upperCaseFirstChar } from '#functions';
import BaseSkyBlockCommand from './~base-skyblock-command';
import type { FetchedData } from './~base-skyblock-command';
import type { CommandContext } from '#structures/commands/BaseCommand';

export default class SlayersCommand extends BaseSkyBlockCommand {
	constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder().setDescription("shows a player's slayer stats"),
			cooldown: seconds(1),
		});
	}

	/**
	 * data -> reply
	 * @param data
	 */
	override _generateReply({ ign, uuid, profile }: FetchedData) {
		const member = profile.members[uuid]!;
		const reply = [`${ign} (${profile.cute_name}): `];

		let totalXp = 0;

		for (const slayer of SLAYERS) {
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
			const XP = member.slayer_bosses?.[slayer]?.xp ?? 0;

			totalXp += XP;

			reply.push(`${upperCaseFirstChar(slayer)} ${getSlayerLevel(XP)} (${shortenNumber(XP)} XP)`);
		}

		reply[0] += `${shortenNumber(totalXp)} Slayer XP`;

		return reply.join(' | ');
	}
}
