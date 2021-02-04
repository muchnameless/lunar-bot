'use strict';

const { MessageEmbed } = require('discord.js');
const Command = require('../../structures/Command');
const logger = require('../../functions/logger');


module.exports = class TaxAmountCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'set the tax amount',
			args: true,
			usage: '[new `amount`]',
			cooldown: 1,
		});
	}

	async run(client, config, message, args, flags, rawArgs) {
		if (/\D/.test(args[0])) return message.reply(`\`${args[0]}\` is not a number.`);

		const NEW_AMOUNT = Number(args[0]);
		const OLD_AMOUNT = Number(config.get('TAX_AMOUNT'));

		await config.set('TAX_AMOUNT', NEW_AMOUNT);

		// update tax collectors if they have the default amount
		await Promise.all(client.taxCollectors.filter(taxCollector => taxCollector.isCollecting).map(async (_, uuid) => {
			const player = client.players.get(uuid);
			if (player.amount === OLD_AMOUNT && player.collectedBy === uuid) return player.setToPaid();
		}));

		client.log(new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
			.setTitle('Guild Tax')
			.setDescription(`${message.author.tag} | ${message.author} changed the guild tax amount`)
			.addFields(
				{ name: 'Old amount', value: `\`\`\`\n${OLD_AMOUNT.toLocaleString(config.get('NUMBER_FORMAT'))}\`\`\``, inline: true },
				{ name: 'New amount', value: `\`\`\`\n${NEW_AMOUNT.toLocaleString(config.get('NUMBER_FORMAT'))}\`\`\``, inline: true },
			)
			.setTimestamp(),
		);

		message.reply(`changed the guild tax amount from \`${OLD_AMOUNT.toLocaleString(config.get('NUMBER_FORMAT'))}\` to \`${NEW_AMOUNT.toLocaleString(config.get('NUMBER_FORMAT'))}\``);
	}
};
