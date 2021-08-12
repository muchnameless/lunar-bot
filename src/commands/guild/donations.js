'use strict';

const { Formatters } = require('discord.js');
const { stripIndent } = require('common-tags');
const MessageEmbedUtil = require('../../util/MessageEmbedUtil');
const mojang = require('../../api/mojang');
const SlashCommand = require('../../structures/commands/SlashCommand');
const logger = require('../../functions/logger');


module.exports = class DonationsCommand extends SlashCommand {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'donations leaderboard',
			options: [],
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async run(interaction) {
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
		return await this.reply(interaction, { embeds: [ embed ] });
	}
};
