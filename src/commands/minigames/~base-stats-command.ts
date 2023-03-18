import type { ChatInputCommandInteraction } from 'discord.js';
import { hypixel } from '#api';
import type { HypixelUserMessage } from '#chatBridge/HypixelMessage.js';
import { formatDecimalNumber, formatError, getUuidAndIgn } from '#functions';
import { logger } from '#logger';
import { DualCommand } from '#structures/commands/DualCommand.js';
import type { Awaited } from '#types';
import { InteractionUtil } from '#utils';

export type FetchedData = Awaited<ReturnType<BaseStatsCommand['_fetchData']>>;

export default class BaseStatsCommand extends DualCommand {
	/**
	 * @param ctx
	 * @param ignOrUuid
	 */
	protected async _fetchData(
		ctx: ChatInputCommandInteraction<'cachedOrDM'> | HypixelUserMessage,
		ignOrUuid?: string | null,
	) {
		const { uuid, ign } = await getUuidAndIgn(ctx, ignOrUuid);

		return {
			ign,
			playerData: (await hypixel.player.uuid(uuid)).player,
		};
	}

	/**
	 * @param kills
	 * @param deaths
	 */
	protected calculateKD(kills?: number | string | null, deaths?: number | string | null) {
		if (typeof kills !== 'number' || typeof deaths !== 'number') return null;
		return formatDecimalNumber(Math.trunc((Number(kills) / Math.max(Number(deaths), 1)) * 100) / 100);
	}

	/**
	 * data -> reply
	 *
	 * @param data
	 */
	protected _generateReply(data: FetchedData): string {
		throw new Error('not implemented');
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 */
	public override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		try {
			return InteractionUtil.reply(
				interaction,
				this._generateReply(await this._fetchData(interaction, interaction.options.getString('ign'))),
			);
		} catch (error) {
			logger.error({ err: error, msg: `[${this.name.toUpperCase()} CMD]` });
			return InteractionUtil.reply(interaction, formatError(error));
		}
	}

	/**
	 * execute the command
	 *
	 * @param hypixelMessage
	 */
	public override async minecraftRun(hypixelMessage: HypixelUserMessage) {
		try {
			return hypixelMessage.reply(
				this._generateReply(await this._fetchData(hypixelMessage, hypixelMessage.commandData.args[0])),
			);
		} catch (error) {
			logger.error({ err: error, msg: `[${this.name.toUpperCase()} CMD]` });
			return hypixelMessage.reply(formatError(error));
		}
	}
}
