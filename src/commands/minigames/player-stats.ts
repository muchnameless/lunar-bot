import { SlashCommandBuilder, time } from 'discord.js';
import { oneLine } from 'common-tags';
import { getPlayerRank, getNetworkLevel } from '@zikeji/hypixel';
import { optionalIgnOption } from '#structures/commands/commonOptions';
import { hypixel } from '#api';
import { escapeIgn, formatNumber, getUuidAndIgn, seconds } from '#functions';
import BaseStatsCommand from './~base-stats-command';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandContext } from '#structures/commands/BaseCommand';
import type { HypixelUserMessage } from '#chatBridge/HypixelMessage';
import type { Awaited } from '#types';

export type FetchedData = Awaited<ReturnType<PlayerStatsCommand['_fetchData']>>;

export default class PlayerStatsCommand extends BaseStatsCommand {
	constructor(context: CommandContext) {
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
	// eslint-disable-next-line class-methods-use-this
	override async _fetchData(ctx: ChatInputCommandInteraction<'cachedOrDM'> | HypixelUserMessage, ignOrUuid: string) {
		const { uuid, ign } = await getUuidAndIgn(ctx, ignOrUuid);
		const [{ player: playerData }, { guild: guildData }, { records: friendsData }] = await Promise.all([
			hypixel.player.uuid(uuid),
			hypixel.guild.player(uuid),
			hypixel.friends.uuid(uuid),
		]);
		const statusData =
			playerData?.lastLogin && playerData.lastLogout
				? playerData.lastLogin > playerData.lastLogout
				: (await hypixel.status.uuid(uuid)).session.online;

		return {
			ign,
			playerData,
			guildData,
			friendsData,
			statusData,
		};
	}

	/**
	 * data -> reply
	 * @param data
	 */
	override _generateReply({ ign, playerData, guildData, friendsData, statusData }: FetchedData) {
		if (!playerData?._id) return `\`${ign}\` never logged into hypixel`;

		const { cleanName: RANK_NAME } = getPlayerRank(playerData);
		const level = Number(getNetworkLevel(playerData).preciseLevel.toFixed(2));

		return oneLine`
			${escapeIgn(ign)}:
			rank: ${RANK_NAME},
			guild: ${guildData?.name ?? 'none'},
			status: ${statusData ? 'online' : 'offline'},
			friends: ${formatNumber(friendsData.length)},
			level: ${level},
			achievement points: ${formatNumber(playerData.achievementPoints ?? 0)},
			karma: ${formatNumber(playerData.karma ?? 0)},
			first joined: ${time(seconds(Number.parseInt(playerData._id.slice(0, 8), 16)))},
			last joined: ${playerData.lastLogin ? time(playerData.lastLogin) : 'unknown'}
		`;
	}
}
