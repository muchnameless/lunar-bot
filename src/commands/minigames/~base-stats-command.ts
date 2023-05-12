import type { Components } from '@zikeji/hypixel';
import type { ChatInputCommandInteraction } from 'discord.js';
import { hypixel } from '#api';
import type { HypixelUserMessage } from '#chatBridge/HypixelMessage.js';
import { escapeIgn, formatDecimalNumber, getUuidAndIgn } from '#functions';
import { DualCommand } from '#structures/commands/DualCommand.js';
import type { Awaited } from '#types';
import { InteractionUtil } from '#utils';

export type FetchedData = Awaited<ReturnType<BaseStatsCommand['_fetchData']>>;

interface ReplyData {
	ign: string;
	reply: string[];
}

export default abstract class BaseStatsCommand extends DualCommand {
	protected abstract readonly statsType: string;

	protected static readonly REPLY_SEPARATOR = ', ';

	/**
	 * @param ign
	 */
	protected noStats(ign: string) {
		return `\`${ign}\` has no ${this.statsType} stats`;
	}

	/**
	 * @param player
	 * @param ign
	 */
	protected assertPlayer(
		player: Components.Schemas.NullablePlayer,
		ign: string,
	): asserts player is Components.Schemas.Player {
		if (!player?._id) throw `\`${ign}\` never joined hypixel`;
	}

	/**
	 * @param ctx
	 * @param ignOrUuid
	 */
	protected async _fetchData(
		ctx: ChatInputCommandInteraction<'cachedOrDM'> | HypixelUserMessage,
		ignOrUuid?: string | null,
	) {
		const { uuid, ign } = await getUuidAndIgn(ctx, ignOrUuid);
		const { player } = await hypixel.player.uuid(uuid);

		this.assertPlayer(player, ign);

		return {
			ign,
			player,
		};
	}

	/**
	 * @param kills
	 * @param deaths
	 */
	protected calculateKD(kills?: number | string | null, deaths?: number | string | null) {
		if (typeof kills !== 'number' || typeof deaths !== 'number') return null;

		return formatDecimalNumber(Math.trunc((kills / Math.max(deaths, 1)) * 100) / 100);
	}

	/**
	 * @param data
	 */
	protected finaliseReply(data: ReplyData | string) {
		if (typeof data === 'string') return data;

		return `${escapeIgn(data.ign)}: ${this.statsType}: ${data.reply.join(BaseStatsCommand.REPLY_SEPARATOR)}`;
	}

	/**
	 * data -> reply
	 *
	 * @param data
	 */
	protected abstract _generateReply(data: FetchedData): ReplyData | string;

	/**
	 * execute the command
	 *
	 * @param interaction
	 */
	public override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		return InteractionUtil.reply(
			interaction,
			this.finaliseReply(this._generateReply(await this._fetchData(interaction, interaction.options.getString('ign')))),
		);
	}

	/**
	 * execute the command
	 *
	 * @param hypixelMessage
	 */
	public override async minecraftRun(hypixelMessage: HypixelUserMessage) {
		return hypixelMessage.reply(
			this.finaliseReply(
				this._generateReply(await this._fetchData(hypixelMessage, hypixelMessage.commandData.args[0])),
			),
		);
	}
}
