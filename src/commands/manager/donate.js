'use strict';

const { Formatters, Constants } = require('discord.js');
const { validateNumber } = require('../../functions/stringValidators');
const { removeNumberFormatting, safePromiseAll } = require('../../functions/util');
const SlashCommand = require('../../structures/commands/SlashCommand');
// const logger = require('../../functions/logger');


module.exports = class DonateCommand extends SlashCommand {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'register a donation from a player',
			options: [{
				name: 'player',
				type: Constants.ApplicationCommandOptionTypes.STRING,
				description: 'IGN | UUID | discord ID | @mention',
				required: true,
			}, {
				name: 'value',
				type: Constants.ApplicationCommandOptionTypes.STRING,
				description: 'amount / text',
				required: true,
			}, {
				name: 'notes',
				type: Constants.ApplicationCommandOptionTypes.STRING,
				description: 'additional notes',
				required: false,
			}],
			defaultPermission: true,
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) {
		const collector = this.client.taxCollectors.getById(interaction.user.id);

		if (!collector?.isCollecting) return interaction.reply('this command is restricted to (active) tax collectors');

		const player = this.getPlayer(interaction);
		const AMOUNT_OR_TEXT = interaction.options.getString('value');
		const TEXT_INPUT = interaction.options.getString('notes');

		let amount = removeNumberFormatting(AMOUNT_OR_TEXT);
		let notes;

		if (validateNumber(amount)) {
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

		interaction.reply(`registered a donation from \`${player.ign}\` of \`${this.client.formatNumber(amount)}\`${notes?.length ? ` (${notes})` : ''}`);

		this.client.log(this.client.defaultEmbed
			.setTitle('Guild Donations')
			.addFields({
				name: `/ah ${collector.ign}`,
				value: Formatters.codeBlock(`${player.ign}: ${this.client.formatNumber(amount)} (manually)${notes?.length ? `\n(${notes})` : ''}`),
			}),
		);
	}
};
