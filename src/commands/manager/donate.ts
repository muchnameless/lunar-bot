import { codeBlock, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { formatNumber, removeNumberFormatting, safePromiseAll, validateNumber } from '#functions';
import { ApplicationCommand } from '#structures/commands/ApplicationCommand.js';
import type { CommandContext } from '#structures/commands/BaseCommand.js';
import { requiredPlayerOption } from '#structures/commands/commonOptions.js';
import { TransactionType } from '#structures/database/models/Transaction.js';
import { InteractionUtil } from '#utils';

export default class DonateCommand extends ApplicationCommand {
	public constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder()
				.setDescription('register a donation from a player')
				.addStringOption(requiredPlayerOption)
				.addStringOption((option) =>
					option //
						.setName('value')
						.setDescription('amount / text')
						.setRequired(true),
				)
				.addStringOption((option) =>
					option //
						.setName('notes')
						.setDescription('additional notes')
						.setRequired(false),
				),
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 */
	public override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		const collector = this.client.taxCollectors.getById(interaction.user.id);

		if (!collector?.isCollecting) {
			return InteractionUtil.reply(interaction, 'this command is restricted to (active) tax collectors');
		}

		const player = InteractionUtil.getPlayer(interaction, { throwIfNotFound: true });
		const AMOUNT_OR_TEXT = interaction.options.getString('value');
		const TEXT_INPUT = interaction.options.getString('notes');

		let amount: number | string | undefined = removeNumberFormatting(AMOUNT_OR_TEXT);
		let notes: string | null;

		if (validateNumber(amount!)) {
			amount = Number(amount);
			notes = TEXT_INPUT;
		} else {
			amount = 0;
			notes = [AMOUNT_OR_TEXT, TEXT_INPUT].filter((x) => x !== null).join(' ');
		}

		await safePromiseAll(
			player.addTransfer({
				amount,
				collectedBy: collector.minecraftUuid,
				notes,
				type: TransactionType.Donation,
			}),
		);

		void this.client.log(
			this.client.defaultEmbed //
				.setTitle('Guild Donations')
				.addFields({
					name: `/ah ${collector}`,
					value: codeBlock(`${player}: ${formatNumber(amount)} (manually)${notes ? `\n(${notes})` : ''}`),
				}),
		);

		return InteractionUtil.reply(
			interaction,
			`registered a donation from \`${player}\` of \`${formatNumber(amount)}\`${notes ? ` (${notes})` : ''}`,
		);
	}
}
