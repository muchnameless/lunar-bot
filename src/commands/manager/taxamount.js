'use strict';

const { MessageEmbed } = require('discord.js');
const { removeNumberFormatting } = require('../../functions/util');
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

		await config.set('TAX_AMOUNT', newAmount);

		// update tax collectors if they have the default amount
		await Promise.all(client.taxCollectors.cache.filter(taxCollector => taxCollector.isCollecting).map(async (_, uuid) => {
			const player = client.players.cache.get(uuid);
			if (player.amount === OLD_AMOUNT && player.collectedBy === uuid) return player.setToPaid();
		}));

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
