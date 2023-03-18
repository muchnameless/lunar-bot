import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { HypixelUserMessage } from '#chatBridge/HypixelMessage.js';
import { randomNumber } from '#functions';
import type { CommandContext } from '#structures/commands/BaseCommand.js';
import { DualCommand } from '#structures/commands/DualCommand.js';
import { InteractionUtil } from '#utils';

export default class CoinFlipCommand extends DualCommand {
	public constructor(context: CommandContext) {
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
	 *
	 * @param interaction
	 */
	public override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		return InteractionUtil.reply(interaction, await this._generateReply());
	}

	/**
	 * execute the command
	 *
	 * @param hypixelMessage
	 */
	public override async minecraftRun(hypixelMessage: HypixelUserMessage) {
		return hypixelMessage.reply(await this._generateReply());
	}
}
