import { SlashCommandBuilder, time } from 'discord.js';
import { oneLine } from 'common-tags';
import { getPlayerRank, getNetworkLevel } from '@zikeji/hypixel';
import { hypixel } from '../../api';
import { optionalIgnOption } from '../../structures/commands/commonOptions';
import { escapeIgn, formatNumber, getUuidAndIgn, seconds } from '../../functions';
import BaseStatsCommand from './~base-stats-command';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';
import type { HypixelUserMessage } from '../../structures/chat_bridge/HypixelMessage';
import type { Awaited } from '../../types/util';

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
				args: false,
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
		const [playerData, guildData, friendsData] = await Promise.all([
			hypixel.player.uuid(uuid),
			hypixel.guild.player(uuid),
			hypixel.friends.uuid(uuid),
		]);
		const statusData =
			Reflect.has(playerData, 'lastLogin') && Reflect.has(playerData, 'lastLogout')
				? playerData.lastLogin! > playerData.lastLogout!
				: (await hypixel.status.uuid(uuid)).online;

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
		const { _id, lastLogin, achievementPoints = 0, karma = 0 } = playerData ?? {};

		if (!_id) return `\`${ign}\` never logged into hypixel`;

		const { cleanName: RANK_NAME } = getPlayerRank(playerData);
		const level = Number(getNetworkLevel(playerData).preciseLevel.toFixed(2));

		return oneLine`
			${escapeIgn(ign)}:
			rank: ${RANK_NAME},
			guild: ${guildData?.name ?? 'none'},
			status: ${statusData ? 'online' : 'offline'},
			friends: ${formatNumber(friendsData?.length ?? 0)},
			level: ${level},
			achievement points: ${formatNumber(achievementPoints)},
			karma: ${formatNumber(karma)},
			first joined: ${time(Number.parseInt(_id.slice(0, 8), 16))},
			last joined: ${lastLogin ? time(lastLogin) : 'unknown'}
		`;
	}
}
