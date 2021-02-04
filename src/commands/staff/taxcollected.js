'use strict';

const { MessageEmbed } = require('discord.js');
const { escapeIgn } = require('../../functions/util');


module.exports = {
	aliases: [ 'collected' ],
	description: 'show a list of taxahs and their collected tax amount',
	// usage: '',
	cooldown: 1,
	execute: async (message, args, flags) => {
		const { client } = message;
		const { config, taxCollectors } = client;
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
	},
};
