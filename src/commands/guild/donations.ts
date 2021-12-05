import { SlashCommandBuilder } from '@discordjs/builders';
import { Formatters } from 'discord.js';
import { stripIndent } from 'common-tags';
import { mojang } from '../../api';
import { InteractionUtil, MessageEmbedUtil } from '../../util';
import { formatNumber, logger } from '../../functions';
import { TransactionTypes } from '../../structures/database/models/Transaction';
import { ApplicationCommand } from '../../structures/commands/ApplicationCommand';
import type { CommandInteraction } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';

export default class DonationsCommand extends ApplicationCommand {
	constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder().setDescription('donations leaderboard'),
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async runSlash(interaction: CommandInteraction) {
		// aquire donations from db
		const donations = await this.client.db.models.Transaction.findAll({
			where: { type: TransactionTypes.DONATION },
		});

		// construct { donator: amount } object
		const donators = [...new Set(donations.map(({ from }) => from))];
		const reducedAmount = Object.fromEntries(donators.map((x) => [x, 0]));
		const reducedNotes: Record<string, string[]> = Object.fromEntries(donators.map((x) => [x, []]));

		// fill said object
		for (const { from, amount, notes } of donations) {
			reducedAmount[from] += amount;
			if (notes?.length) reducedNotes[from].push(notes);
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
						(await mojang.uuid(minecraftUuid).catch((error) => logger.error(error)))?.ign ??
						minecraftUuid;
					const notes = reducedNotes[minecraftUuid].join('\n');

					embed.addFields({
						name: '\u200B',
						value: Formatters.codeBlock(
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

					MessageEmbedUtil.padFields(embed);

					totalAmount += amount;
				}),
		);

		embed.setDescription(`Total: ${formatNumber(totalAmount)}`);

		// create and send embed
		return InteractionUtil.reply(interaction, { embeds: [embed] });
	}
}
