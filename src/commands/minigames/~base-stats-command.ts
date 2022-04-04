import { hypixel } from '../../api';
import { InteractionUtil } from '../../util';
import { formatDecimalNumber, formatError, getUuidAndIgn } from '../../functions';
import { DualCommand } from '../../structures/commands/DualCommand';
import { logger } from '../../logger';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { HypixelUserMessage } from '../../structures/chat_bridge/HypixelMessage';
import type { Awaited } from '../../types/util';

export type FetchedData = Awaited<ReturnType<BaseStatsCommand['_fetchData']>>;

export default class BaseStatsCommand extends DualCommand {
	/**
	 * @param ctx
	 * @param ignOrUuid
	 */
	// eslint-disable-next-line class-methods-use-this
	async _fetchData(ctx: ChatInputCommandInteraction | HypixelUserMessage, ignOrUuid: string | null) {
		const { uuid, ign } = await getUuidAndIgn(ctx, ignOrUuid);

		return {
			ign,
			playerData: await hypixel.player.uuid(uuid),
		};
	}

	/**
	 * @param kills
	 * @param deaths
	 */
	// eslint-disable-next-line class-methods-use-this
	calculateKD(kills?: number | string | null, deaths?: number | string | null) {
		if (kills == null || deaths == null) return null;
		return formatDecimalNumber(Math.trunc((Number(kills) / Math.max(Number(deaths), 1)) * 100) / 100);
	}

	/**
	 * data -> reply
	 * @param data
	 */
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	_generateReply(data: FetchedData): string {
		throw new Error('not implemented');
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async runSlash(interaction: ChatInputCommandInteraction) {
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
	 * @param hypixelMessage
	 */
	override async runMinecraft(hypixelMessage: HypixelUserMessage) {
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
