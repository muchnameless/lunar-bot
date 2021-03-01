'use strict';

const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class TaxCollectedCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'show a list of taxahs and their collected tax amount',
			usage: '',
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(message, args, flags, rawArgs) {
		message.reply(this.client.taxCollectors.createTaxCollectedEmbed());
	}
};
