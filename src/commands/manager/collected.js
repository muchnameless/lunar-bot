'use strict';

const SlashCommand = require('../../structures/commands/SlashCommand');
// const logger = require('../../functions/logger');


module.exports = class CollectedCommand extends SlashCommand {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'show a list of taxahs and their collected tax amount',
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
		return interaction.reply({
			embeds: [ this.client.taxCollectors.createTaxCollectedEmbed() ],
		});
	}
};
