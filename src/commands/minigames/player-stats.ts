import { getPlayerRank, getNetworkLevel } from '@zikeji/hypixel';
import { SlashCommandBuilder, time, type ChatInputCommandInteraction } from 'discord.js';
import BaseStatsCommand from './~base-stats-command.js';
import { hypixel } from '#api';
import type { HypixelUserMessage } from '#chatBridge/HypixelMessage.js';
import { formatNumber, getUuidAndIgn, parseSecondsFromObjectId, seconds } from '#functions';
import type { CommandContext } from '#structures/commands/BaseCommand.js';
import { optionalIgnOption } from '#structures/commands/commonOptions.js';
import type { Awaited } from '#types';

export type FetchedData = Awaited<ReturnType<PlayerStatsCommand['_fetchData']>>;

export default class PlayerStatsCommand extends BaseStatsCommand {
	protected readonly statsType = 'Hypixel';

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
		const [{ player }, { guild }] = await Promise.all([hypixel.player.uuid(uuid), hypixel.guild.player(uuid)]);

		this.assertPlayer(player, ign);

		const status =
			player?.lastLogin && player.lastLogout
				? player.lastLogin > player.lastLogout
				: (await hypixel.status.uuid(uuid)).session.online;

		return {
			ign,
			player,
			guild,
			status,
		};
	}

	/**
	 * data -> reply
	 *
	 * @param data
	 */
	protected override _generateReply({ ign, player, guild, status }: FetchedData) {
		const { cleanName: RANK_NAME } = getPlayerRank(player);
		const level = Number(getNetworkLevel(player).preciseLevel.toFixed(2));

		return {
			ign,
			reply: [
				`rank: ${RANK_NAME}`,
				`guild: ${guild?.name ?? 'none'}`,
				`status: ${status ? 'online' : 'offline'}`,
				`level: ${level}`,
				`achievement points: ${formatNumber(player.achievementPoints ?? 0)}`,
				`karma: ${formatNumber(player.karma ?? 0)}`,
				`first joined: ${time(parseSecondsFromObjectId(player))}`,
				`last joined: ${player.lastLogin ? time(seconds.fromMilliseconds(player.lastLogin)) : 'unknown'}`,
			],
		};
	}
}
