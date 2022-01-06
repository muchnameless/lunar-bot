import { SlashCommandBuilder } from '@discordjs/builders';
import { optionalIgnOption, skyblockProfileOption } from '../../structures/commands/commonOptions';
import { getSlayerLevel, seconds, shortenNumber, upperCaseFirstChar } from '../../functions';
import { SLAYERS } from '../../constants';
import BaseSkyBlockCommand from './~base-skyblock-command';
import type { FetchedData } from './~base-skyblock-command';
import type { CommandContext } from '../../structures/commands/BaseCommand';

export default class SlayersCommand extends BaseSkyBlockCommand {
	constructor(context: CommandContext) {
		super(
			context,
			{
				slash: new SlashCommandBuilder()
					.setDescription("shows a player's slayer stats")
					.addStringOption(optionalIgnOption)
					.addStringOption(skyblockProfileOption),
				cooldown: seconds(1),
			},
			{
				aliases: [],
				args: false,
				usage: '<`IGN`> <`profile` name>',
			},
		);
	}

	/**
	 * data -> reply
	 * @param data
	 */
	override _generateReply({ ign, uuid, profile }: FetchedData) {
		const member = profile.members[uuid];
		const reply = [`${ign} (${profile.cute_name}): `];

		let totalXp = 0;

		for (const slayer of SLAYERS) {
			const XP = member.slayer_bosses?.[slayer]?.xp ?? 0;

			totalXp += XP;

			reply.push(`${upperCaseFirstChar(slayer)} ${getSlayerLevel(XP)} (${shortenNumber(XP)} XP)`);
		}

		reply[0] += `${shortenNumber(totalXp)} Slayer XP`;

		return reply.join(' | ');
	}
}
