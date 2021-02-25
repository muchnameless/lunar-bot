'use strict';

const { MessageEmbed } = require('discord.js');
const { removeNumberFormatting } = require('../../functions/util');
const Command = require('../../structures/commands/Command');
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
		let newAmount = removeNumberFormatting(args.shift());

		if (/\D/.test(newAmount)) return message.reply(`\`${newAmount}\` is not a number.`);

		const OLD_AMOUNT = config.getNumber('TAX_AMOUNT');

		newAmount = Number(newAmount);

		// update tax amount
		await config.set('TAX_AMOUNT', newAmount);

		// update tax collectors
		await Promise.all(client.taxCollectors.activeCollectors.map(async taxCollector => {
			taxCollector.collectedTax += newAmount - OLD_AMOUNT;
			return taxCollector.save();
		}));

		// logging
		client.log(new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
			.setTitle('Guild Tax')
			.setDescription(`${message.author.tag} | ${message.author} changed the guild tax amount`)
			.addFields(
				{ name: 'Old amount', value: `\`\`\`\n${OLD_AMOUNT.toLocaleString(config.get('NUMBER_FORMAT'))}\`\`\``, inline: true },
				{ name: 'New amount', value: `\`\`\`\n${newAmount.toLocaleString(config.get('NUMBER_FORMAT'))}\`\`\``, inline: true },
			)
			.setTimestamp(),
		);

		message.reply(`changed the guild tax amount from \`${OLD_AMOUNT.toLocaleString(config.get('NUMBER_FORMAT'))}\` to \`${newAmount.toLocaleString(config.get('NUMBER_FORMAT'))}\``);
	}
};
