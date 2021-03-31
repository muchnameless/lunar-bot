'use strict';

const { MessageEmbed } = require('discord.js');
const { validateNumber } = require('../../functions/stringValidators');
const { removeNumberFormatting, safePromiseAll } = require('../../functions/util');
const Command = require('../../structures/commands/Command');
// const logger = require('../../functions/logger');


module.exports = class DonateCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'register a donation from a player',
			args: 2,
			usage: '[`IGN`|`@mention`] [`amount` / `text`]',
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
		const collector = this.client.taxCollectors.getByID(message.author.id);

		if (!collector?.isCollecting) return message.reply('this command is restricted to tax collectors.');

		const [ IGN, AMOUNT_OR_TEXT, ...textInput ] = args;
		/**
		 * @type {import('../../structures/database/models/Player')}
		 */
		const player = message.mentions.users.size
			? message.mentions.users.first().player
			: this.client.players.getByIGN(IGN);

		if (!player) return message.reply(`no player ${message.mentions.users.size
			? `linked to \`${message.guild
				? message.mentions.members.first().displayName
				: message.mentions.users.first().username
			}\``
			: `with the IGN \`${IGN}\``
		} found.`);

		let amount = removeNumberFormatting(AMOUNT_OR_TEXT);
		let notes;

		if (validateNumber(amount)) {
			amount = Number(amount);
			notes = textInput.length ? textInput.join(' ') : null;
		} else {
			amount = 0;
			notes = [ AMOUNT_OR_TEXT, ...textInput ].join(' ');
		}

		await safePromiseAll(player.addTransfer({
			amount,
			collectedBy: collector.minecraftUUID,
			notes,
			type: 'donation',
		}));

		message.reply(`registered a donation from \`${player.ign}\` of \`${this.client.formatNumber(amount)}\`${notes?.length ? ` (${notes})` : ''}.`);

		this.client.log(new MessageEmbed()
			.setColor(this.config.get('EMBED_BLUE'))
			.setTitle('Guild Donations')
			.addField(`/ah ${collector.ign}`, `\`\`\`\n${player.ign}: ${this.client.formatNumber(amount)} (manually)${notes?.length ? `\n(${notes})` : ''}\`\`\``)
			.setTimestamp(),
		);
	}
};
