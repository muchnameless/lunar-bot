import { getPlayerRank, getNetworkLevel } from '@zikeji/hypixel';
import { oneLine } from 'common-tags';
import { SlashCommandBuilder, time, type ChatInputCommandInteraction } from 'discord.js';
import BaseStatsCommand from './~base-stats-command.js';
import { hypixel } from '#api';
import { type HypixelUserMessage } from '#chatBridge/HypixelMessage.js';
import { escapeIgn, formatNumber, getUuidAndIgn, parseSecondsFromObjectId, seconds } from '#functions';
import { type CommandContext } from '#structures/commands/BaseCommand.js';
import { optionalIgnOption } from '#structures/commands/commonOptions.js';
import { type Awaited } from '#types';

export type FetchedData = Awaited<ReturnType<PlayerStatsCommand['_fetchData']>>;

export default class PlayerStatsCommand extends BaseStatsCommand {
	public constructor(context: CommandContext) {
		super(
			context,
			{
				slash: new SlashCommandBuilder()
					.setDescription("shows a player's hypixel stats")
					.addStringOption(optionalIgnOption),
				cooldown: seconds(1),
			},
			{
				aliases: ['player'],
				usage: '<`IGN`>',
			},
		);
	}

	/**
	 * @param ctx
	 * @param ignOrUuid
	 */
	protected override async _fetchData(
		ctx: ChatInputCommandInteraction<'cachedOrDM'> | HypixelUserMessage,
		ignOrUuid: string,
	) {
		const { uuid, ign } = await getUuidAndIgn(ctx, ignOrUuid);
		const [{ player: playerData }, { guild: guildData }] = await Promise.all([
			hypixel.player.uuid(uuid),
			hypixel.guild.player(uuid),
		]);
		const statusData =
			playerData?.lastLogin && playerData.lastLogout
				? playerData.lastLogin > playerData.lastLogout
				: (await hypixel.status.uuid(uuid)).session.online;

		return {
			ign,
			playerData,
			guildData,
			statusData,
		};
	}

	/**
	 * data -> reply
	 *
	 * @param data
	 */
	protected override _generateReply({ ign, playerData, guildData, statusData }: FetchedData) {
		if (!playerData?._id) return `\`${ign}\` never logged into hypixel`;

		const { cleanName: RANK_NAME } = getPlayerRank(playerData);
		const level = Number(getNetworkLevel(playerData).preciseLevel.toFixed(2));

		return oneLine`
			${escapeIgn(ign)}:
			rank: ${RANK_NAME},
			guild: ${guildData?.name ?? 'none'},
			status: ${statusData ? 'online' : 'offline'},
			level: ${level},
			achievement points: ${formatNumber(playerData.achievementPoints ?? 0)},
			karma: ${formatNumber(playerData.karma ?? 0)},
			first joined: ${time(parseSecondsFromObjectId(playerData))},
			last joined: ${playerData.lastLogin ? time(seconds.fromMilliseconds(playerData.lastLogin)) : 'unknown'}
		`;
	}
}
