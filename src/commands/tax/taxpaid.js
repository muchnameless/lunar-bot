'use strict';

const { removeNumberFormatting } = require('../../functions/util');
const Command = require('../../structures/commands/Command');
// const logger = require('../../functions/logger');


module.exports = class TaxPaidCommand extends Command {
	constructor(data, options) {
		super(data, options ?? {
			aliases: [ 'paid' ],
			description: 'manually set a player to paid',
			args: true,
			usage: () => `[\`IGN\`|\`@mention\`] <custom \`amount\` to overwrite the default of ${this.config.getNumber('TAX_AMOUNT')?.toLocaleString(this.config.get('NUMBER_FORMAT')) ?? 'none set'}>`,
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
	async run(message, args, flags, rawArgs) { // eslint-disable-line no-unused-vars
		const { players } = this.client;
		const collector = this.client.taxCollectors.getByID(message.author.id);

		if (!collector?.isCollecting) return message.reply('this command is restricted to tax collectors.');

		const IGN = args.shift();
		/**
		 * @type {import('../../structures/database/models/Player')}
		 */
		const player = message.mentions.users.size
			? message.mentions.users.first().player
			: players.getByIGN(IGN);

		if (!player) return message.reply(`no player ${message.mentions.users.size
			? `linked to \`${message.guild
				? message.mentions.members.first().displayName
				: message.mentions.users.first().username
			}\``
			: `with the IGN \`${IGN}\``
		} found.`);

		if (player.paid) {
			if (!this.force(flags)) {
				const OLD_AMOUNT = await player.taxAmount;
				const ANSWER = await message.awaitReply(`\`${player.ign}\` is already set to paid with an amount of \`${this.client.formatNumber(OLD_AMOUNT)}\`. Overwrite this?`, 30);

				if (!this.config.getArray('REPLY_CONFIRMATION').includes(ANSWER?.toLowerCase())) return message.reply('the command has been cancelled.');
			}

			await player.resetTax();
		}

		const CUSTOM_AMOUNT = removeNumberFormatting(args.shift());
		const AMOUNT = /\D/.test(CUSTOM_AMOUNT) ? this.config.getNumber('TAX_AMOUNT') : Number(CUSTOM_AMOUNT);

		await player.setToPaid({
			amount: AMOUNT,
			collectedBy: collector.minecraftUUID,
		});

		message.reply(`\`${player.ign}\` manually set to paid with ${AMOUNT === this.config.getNumber('TAX_AMOUNT') ? 'the default' : 'a custom'} amount of \`${this.client.formatNumber(AMOUNT)}\`.`);

		this.client.log(this.client.defaultEmbed
			.setTitle('Guild Tax')
			.addField(`/ah ${collector.ign}`, `\`\`\`\n${player.ign}: ${this.client.formatNumber(AMOUNT)} (manually)\`\`\``),
		);
	}
};
