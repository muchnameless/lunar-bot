import { SlashCommandBuilder } from '@discordjs/builders';
import { Formatters } from 'discord.js';
import { requiredPlayerOption } from '../../structures/commands/commonOptions';
import { InteractionUtil } from '../../util';
import { removeNumberFormatting, safePromiseAll, validateNumber } from '../../functions';
import { ApplicationCommand } from '../../structures/commands/ApplicationCommand';
import type { CommandInteraction } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';


export default class DonateCommand extends ApplicationCommand {
	constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder()
				.setDescription('register a donation from a player')
				.addStringOption(requiredPlayerOption)
				.addStringOption(option => option
					.setName('value')
					.setDescription('amount / text')
					.setRequired(true),
				)
				.addStringOption(option => option
					.setName('notes')
					.setDescription('additional notes')
					.setRequired(false),
				),
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async runSlash(interaction: CommandInteraction) {
		const collector = this.client.taxCollectors.getById(interaction.user.id);

		if (!collector?.isCollecting) return InteractionUtil.reply(interaction, 'this command is restricted to (active) tax collectors');

		const player = InteractionUtil.getPlayer(interaction, { throwIfNotFound: true });
		const AMOUNT_OR_TEXT = interaction.options.getString('value');
		const TEXT_INPUT = interaction.options.getString('notes');

		let amount: string | number | undefined = removeNumberFormatting(AMOUNT_OR_TEXT);
		let notes;

		if (validateNumber(amount!)) {
			amount = Number(amount);
			notes = TEXT_INPUT;
		} else {
			amount = 0;
			notes = [ AMOUNT_OR_TEXT, TEXT_INPUT ].filter(x => x !== null).join(' ');
		}

		await safePromiseAll(player.addTransfer({
			amount,
			collectedBy: collector.minecraftUuid,
			notes,
			type: 'donation',
		}));

		this.client.log(this.client.defaultEmbed
			.setTitle('Guild Donations')
			.addFields({
				name: `/ah ${collector}`,
				value: Formatters.codeBlock(`${player}: ${this.client.formatNumber(amount)} (manually)${notes?.length ? `\n(${notes})` : ''}`),
			}),
		);

		return InteractionUtil.reply(interaction, `registered a donation from \`${player}\` of \`${this.client.formatNumber(amount)}\`${notes?.length ? ` (${notes})` : ''}`);
	}
}
