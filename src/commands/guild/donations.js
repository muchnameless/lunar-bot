import { SlashCommandBuilder } from '@discordjs/builders';
import { Formatters } from 'discord.js';
import { stripIndent } from 'common-tags';
import { mojang } from '../../api/mojang.js';
import { InteractionUtil, MessageEmbedUtil } from '../../util/index.js';
import { logger } from '../../functions/index.js';
import { SlashCommand } from '../../structures/commands/SlashCommand.js';


export default class DonationsCommand extends SlashCommand {
	constructor(context) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('donations leaderboard'),
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async runSlash(interaction) {
		// aquire donations from db
		const donations = await this.client.db.models.Transaction.findAll({
			where: { type: 'donation' },
		});

		// construct { donator: amount } object
		const reducedAmount = Object.fromEntries([ ...new Set(donations.map(({ from }) => from)) ].map(x => [ x, 0 ]));
		const reducedNotes = Object.fromEntries([ ...new Set(donations.map(({ from }) => from)) ].map(x => [ x, [] ]));

		// fill said object
		for (const { from, amount, notes } of donations) {
			reducedAmount[from] += amount;
			if (notes?.length) reducedNotes[from].push(notes);
		}

		// transform and prettify data
		const embed = this.client.defaultEmbed.setTitle('Guild Donations');

		let totalAmount = 0;

		await Promise.all([ ...Object.entries(reducedAmount) ].sort(([ , a ], [ , b ]) => b - a).map(async ([ minecraftUuid, amount ], index) => {
			const IGN = this.client.players.cache.get(minecraftUuid)?.ign ?? (await mojang.uuid(minecraftUuid).catch(logger.error))?.ign ?? minecraftUuid;
			const notes = reducedNotes[minecraftUuid].join('\n');

			embed.addFields({
				name: '\u200b',
				value: Formatters.codeBlock('ada', stripIndent`
					#${`${index + 1}`.padStart(3, '0')} : ${IGN}
						 > ${this.client.formatNumber(amount)}
				`),
				inline: true,
			});

			if (notes) {
				embed.addFields({
					name: '\u200b',
					value: notes,
					inline: true,
				});
			}

			MessageEmbedUtil.padFields(embed);

			totalAmount += amount;
		}));

		embed.setDescription(`Total: ${this.client.formatNumber(totalAmount)}`);

		// create and send embed
		return await InteractionUtil.reply(interaction, { embeds: [ embed ] });
	}
}
