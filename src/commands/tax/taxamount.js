'use strict';

const { MessageEmbed } = require('discord.js');
const { removeNumberFormatting, safePromiseAll } = require('../../functions/util');
const Command = require('../../structures/commands/Command');
// const logger = require('../../functions/logger');


module.exports = class TaxAmountCommand extends Command {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [],
			description: 'set the tax amount',
			args: true,
			usage: '[new `amount`]',
			cooldown: 1,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(message, args, flags, rawArgs) { // eslint-disable-line no-unused-vars
		let newAmount = removeNumberFormatting(args.shift());

		if (/\D/.test(newAmount)) return message.reply(`\`${newAmount}\` is not a number.`);

		const OLD_AMOUNT = this.config.getNumber('TAX_AMOUNT');

		newAmount = Number(newAmount);

		await safePromiseAll([
			// update tax amount
			this.config.set('TAX_AMOUNT', newAmount),

			// update tax collectors
			...this.client.taxCollectors.activeCollectors.map(async (taxCollector) => {
				taxCollector.collectedTax += newAmount - OLD_AMOUNT;
				return taxCollector.save();
			}),
		]);

		// logging
		this.client.log(new MessageEmbed()
			.setColor(this.config.get('EMBED_BLUE'))
			.setTitle('Guild Tax')
			.setDescription(`${message.author.tag} | ${message.author} changed the guild tax amount`)
			.addFields(
				{ name: 'Old amount', value: `\`\`\`\n${this.client.formatNumber(OLD_AMOUNT)}\`\`\``, inline: true },
				{ name: 'New amount', value: `\`\`\`\n${this.client.formatNumber(newAmount)}\`\`\``, inline: true },
			)
			.setTimestamp(),
		);

		message.reply(`changed the guild tax amount from \`${this.client.formatNumber(OLD_AMOUNT)}\` to \`${this.client.formatNumber(newAmount)}\``);
	}
};
