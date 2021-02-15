'use strict';

const { MessageEmbed } = require('discord.js');
const { escapeIgn } = require('../../functions/util');
const Command = require('../../structures/Command');
const logger = require('../../functions/logger');


module.exports = class TaxCollectedCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'collected' ],
			description: 'show a list of taxahs and their collected tax amount',
			usage: '',
			cooldown: 1,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/LunarClient')} client
	 * @param {import('../../structures/database/ConfigHandler')} config
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(client, config, message, args, flags, rawArgs) {
		const { taxCollectors } = client;
		const collectedEmbed = new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
			.setTitle('Collected Guild Tax')
			.setDescription(`Total amount: ${client.formatNumber(taxCollectors.reduce((acc, collector) => acc + collector.collectedAmount, 0))}\n\u200b`)
			.setTimestamp();

		taxCollectors.forEach(collector => {
			collectedEmbed.addField(
				`${escapeIgn(collector.ign)}${collector.isCollecting ? '' : ' (inactive)'}`,
				client.formatNumber(collector.collectedAmount),
			);
		});

		message.reply(collectedEmbed);
	}
};
