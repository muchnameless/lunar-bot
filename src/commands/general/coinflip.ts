import { SlashCommandBuilder } from 'discord.js';
import { InteractionUtil } from '#utils';
import { DualCommand } from '#structures/commands/DualCommand';
import { randomNumber } from '#functions';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { HypixelUserMessage } from '#chatBridge/HypixelMessage';
import type { CommandContext } from '#structures/commands/BaseCommand';

export default class CoinFlipCommand extends DualCommand {
	constructor(context: CommandContext) {
		super(
			context,
			{
				slash: new SlashCommandBuilder().setDescription('heads, tails or ???'),
				cooldown: 0,
			},
			{
				aliases: ['cf', 'flip'],
			},
		);
	}

	/**
	 * coinflip result
	 */
	private async _generateReply() {
		const RANDOM_NUMBER = await randomNumber(0, 1_000);

		if (RANDOM_NUMBER === 0) return 'edge'; // ~ 0.1 %
		if (RANDOM_NUMBER <= 500) return 'heads'; // ~ 49.95 %
		return 'tails'; // ~ 49.95 %
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		return InteractionUtil.reply(interaction, await this._generateReply());
	}

	/**
	 * execute the command
	 * @param hypixelMessage
	 */
	override async minecraftRun(hypixelMessage: HypixelUserMessage) {
		return hypixelMessage.reply(await this._generateReply());
	}
}
