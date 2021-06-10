'use strict';

const { stripIndent } = require('common-tags');
const mojang = require('../../api/mojang');
const SlashCommand = require('../../structures/commands/SlashCommand');
const logger = require('../../functions/logger');


module.exports = class DonationsCommand extends SlashCommand {
	/**
	 * @param {import('../../structures/commands/SlashCommand').CommandData} commandData
	 */
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'donations leaderboard',
			options: [],
			defaultPermission: true,
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) { // eslint-disable-line no-unused-vars
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

		await Promise.all([ ...Object.entries(reducedAmount) ].sort(([ , a ], [ , b ]) => b - a).map(async ([ minecraftUUID, amount ], index) => {
			const IGN = this.client.players.cache.get(minecraftUUID)?.ign ?? (await mojang.uuid(minecraftUUID).catch(logger.error))?.ign ?? minecraftUUID;
			const notes = reducedNotes[minecraftUUID].join('\n');

			embed.addField(
				'\u200b',
				stripIndent`
					\`\`\`ada
					#${`${index + 1}`.padStart(3, '0')} : ${IGN}
						> ${this.client.formatNumber(amount)}
					\`\`\`
				`,
				true,
			);

			if (notes) embed.addField('\u200b', notes, true);

			embed.padFields();

			totalAmount += amount;
		}));

		embed.setDescription(`Total: ${this.client.formatNumber(totalAmount)}`);

		// create and send embed
		return interaction.reply({ embeds: [ embed ] });
	}
};
