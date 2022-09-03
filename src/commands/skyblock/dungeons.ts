import { SlashCommandBuilder } from 'discord.js';
import BaseSkyBlockCommand, { type FetchedData } from './~base-skyblock-command.js';
import { hypixel } from '#api';
import { DUNGEON_CLASSES, DUNGEON_XP_TOTAL, LEVEL_CAP } from '#constants';
import { formatDecimalNumber, formatNumber, getSkillLevel, seconds, shortenNumber } from '#functions';
import { type CommandContext } from '#structures/commands/BaseCommand.js';

export default class DungeonsCommand extends BaseSkyBlockCommand {
	public constructor(context: CommandContext) {
		super(
			context,
			{
				slash: new SlashCommandBuilder().setDescription("shows a player's dungeon stats"),
				cooldown: seconds(1),
			},
			{
				aliases: ['cata'],
			},
		);
	}

	/**
	 * data -> reply
	 *
	 * @param data
	 */
	protected override async _generateReply({ ign, uuid, profile }: FetchedData) {
		const { player } = await hypixel.player.uuid(uuid);
		const SECRETS_FOUND = player?.achievements?.skyblock_treasure_hunter ?? 0;
		const member = profile.members[uuid]!;
		const XP = member.dungeons?.dungeon_types?.catacombs?.experience ?? 0;
		const { progressLevel: catacombsLvl, trueLevel } = getSkillLevel('catacombs', XP);
		const XP_TILL_NEXT =
			trueLevel < LEVEL_CAP.catacombs ? DUNGEON_XP_TOTAL[trueLevel + 1]! - XP : XP - DUNGEON_XP_TOTAL.at(-1)!;
		const CLASS_AVERAGE =
			DUNGEON_CLASSES.reduce(
				(acc, cur) => acc + getSkillLevel(cur, member.dungeons?.player_classes?.[cur]?.experience).nonFlooredLevel,
				0,
			) / DUNGEON_CLASSES.length;

		return `${ign} (${profile.cute_name}): ${catacombsLvl} (${shortenNumber(XP_TILL_NEXT)} ${
			trueLevel < LEVEL_CAP.catacombs ? 'XP till next' : 'Overflow XP'
		}) | ${formatDecimalNumber(CLASS_AVERAGE)} Class Average | ${formatNumber(SECRETS_FOUND)} Secrets found`;
	}
}
