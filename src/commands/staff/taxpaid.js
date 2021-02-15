'use strict';

const { MessageEmbed } = require('discord.js');
const { removeNumberFormatting } = require('../../functions/util');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class TaxPaidCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'paid' ],
			description: 'manually set a player to paid',
			args: true,
			usage: () => `[\`IGN\`|\`@mention\`] <custom \`amount\` to overwrite the default of ${this.client.config.getNumber('TAX_AMOUNT').toLocaleString(this.client.config.get('NUMBER_FORMAT'))}>`,
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
		const { players } = client;
		const collector = client.taxCollectors.getByID(message.author.id);

		if (!collector?.isCollecting) return message.reply('this command is restricted to tax collectors.');

		const IGN = args.shift();
		const player = message.mentions.users.size
			? players.getByID(message.mentions.users.first().id)
			: players.getByIGN(IGN);

		if (!player) return message.reply(`no player ${message.mentions.users.size
			? `linked to \`${message.guild
				? message.mentions.members.first().displayName
				: message.mentions.users.first().username
			}\``
			: `with the IGN \`${IGN}\``
		} found.`);

		if (player.paid) {
			if (!flags.some(flag => [ 'f', 'force' ].includes(flag))) {
				const ANSWER = await message.awaitReply(`\`${player.ign}\` is already set to paid with an amount of \`${client.formatNumber(player.amount)}\`. Overwrite this?`, 30);

				if (!config.getArray('REPLY_CONFIRMATION').includes(ANSWER?.toLowerCase())) return message.reply('the command has been cancelled.');
			}

			await player.resetTax();
		}

		const CUSTOM_AMOUNT = removeNumberFormatting(args.shift());

		await player.setToPaid({
			amount: /\D/.test(CUSTOM_AMOUNT) ? config.getNumber('TAX_AMOUNT') : Number(CUSTOM_AMOUNT),
			collectedBy: collector.minecraftUUID,
		});

		message.reply(`\`${player.ign}\` manually set to paid with ${/\D/.test(CUSTOM_AMOUNT) ? 'the default' : 'a custom'} amount of \`${client.formatNumber(player.amount)}\`.`);

		client.log(new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
			.setTitle('Guild Tax')
			.addField(`/ah ${collector.ign}`, `\`\`\`\n${player.ign}: ${client.formatNumber(player.amount)} (manually)\`\`\``)
			.setTimestamp(),
		);
	}
};
