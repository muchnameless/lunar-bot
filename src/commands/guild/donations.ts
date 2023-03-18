import { stripIndent } from 'common-tags';
import { codeBlock, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { mojang } from '#api';
import { formatNumber } from '#functions';
import { logger } from '#logger';
import { ApplicationCommand } from '#structures/commands/ApplicationCommand.js';
import type { CommandContext } from '#structures/commands/BaseCommand.js';
import { TransactionType } from '#structures/database/models/Transaction.js';
import { EmbedUtil, InteractionUtil } from '#utils';

export default class DonationsCommand extends ApplicationCommand {
	public constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder().setDescription('donations leaderboard'),
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 */
	public override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		// acquire donations from db
		const donations = await this.client.db.models.Transaction.findAll({
			where: { type: TransactionType.Donation },
		});

		// construct { donator: amount } object
		const donators = [...new Set(donations.map(({ from }) => from))];
		const reducedAmount = Object.fromEntries(donators.map((x) => [x, 0]));
		const reducedNotes = Object.fromEntries(donators.map((x) => [x, [] as string[]]));

		// fill said object
		for (const { from, amount, notes } of donations) {
			reducedAmount[from] += amount;
			if (notes) reducedNotes[from]!.push(notes);
		}

		// transform and prettify data
		const embed = this.client.defaultEmbed.setTitle('Guild Donations');

		let totalAmount = 0;

		await Promise.all(
			[...Object.entries(reducedAmount)]
				.sort(([, a], [, b]) => b - a)
				.map(async ([minecraftUuid, amount], index) => {
					const IGN =
						this.client.players.cache.get(minecraftUuid)?.ign ??
						(await mojang.uuid(minecraftUuid).catch((error) => logger.error(error, '[DONATIONS CMD]')))?.ign ??
						minecraftUuid;
					const notes = reducedNotes[minecraftUuid]!.join('\n');

					embed.addFields({
						name: '\u200B',
						value: codeBlock(
							'ada',
							stripIndent`
								#${`${index + 1}`.padStart(3, '0')} : ${IGN}
									 > ${formatNumber(amount)}
							`,
						),
						inline: true,
					});

					if (notes) {
						embed.addFields({
							name: '\u200B',
							value: notes,
							inline: true,
						});
					}

					EmbedUtil.padFields(embed);

					totalAmount += amount;
				}),
		);

		embed.setDescription(`Total: ${formatNumber(totalAmount)}`);

		// create and send embed
		return InteractionUtil.reply(interaction, { embeds: [embed] });
	}
}
