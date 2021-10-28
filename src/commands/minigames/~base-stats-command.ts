import { hypixel } from '../../api';
import { InteractionUtil } from '../../util';
import { getUuidAndIgn, logger } from '../../functions';
import { DualCommand } from '../../structures/commands/DualCommand';
import type { CommandInteraction } from 'discord.js';
import type { HypixelUserMessage } from '../../structures/chat_bridge/HypixelMessage';
import type { Awaited } from '../../types/util';


export type FetchedData = Awaited<ReturnType<StatsCommand['_fetchData']>>;


export default class StatsCommand extends DualCommand {
	/**
	 * @param ctx
	 * @param ignOrUuid
	 */
	async _fetchData(ctx: CommandInteraction | HypixelUserMessage, ignOrUuid: string | null) { // eslint-disable-line class-methods-use-this
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
	calculateKD(kills?: number | string | null, deaths?: number | string | null) {
		if (kills == null || deaths == null) return null;
		return this.client.formatDecimalNumber(Math.floor((Number(kills) / Math.max(Number(deaths), 1)) * 100) / 100);
	}

	/**
	 * data -> reply
	 */
	_generateReply({ ign }: FetchedData) {
		return ign;
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async runSlash(interaction: CommandInteraction) {
		try {
			return InteractionUtil.reply(interaction,
				this._generateReply(
					await this._fetchData(interaction, interaction.options.getString('ign')),
				),
			);
		} catch (error) {
			logger.error(`[${this.name.toUpperCase()} CMD]: ${error}`);
			return InteractionUtil.reply(interaction, `${error}`);
		}
	}

	/**
	 * execute the command
	 * @param hypixelMessage
	 */
	override async runMinecraft(hypixelMessage: HypixelUserMessage) {
		try {
			return hypixelMessage.reply(
				this._generateReply(
					await this._fetchData(hypixelMessage, hypixelMessage.commandData.args[0]),
				),
			);
		} catch (error) {
			logger.error(`[${this.name.toUpperCase()} CMD]: ${error}`);
			return hypixelMessage.reply(`${error}`);
		}
	}
}
