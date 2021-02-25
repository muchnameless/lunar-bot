'use strict';

const { MessageEmbed } = require('discord.js');
const { removeNumberFormatting } = require('../../functions/util');
const Command = require('../../structures/commands/Command');
const logger = require('../../functions/logger');


module.exports = class DonateCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'register a donation from a player',
			args: true,
			usage: '[`IGN`|`@mention`] [`amount` / `text`]',
			cooldown: 0,
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
		if (args.length < 2) return message.reply(this.usageInfo);

		const { players } = client;
		const collector = client.taxCollectors.getByID(message.author.id);

		if (!collector?.isCollecting) return message.reply('this command is restricted to tax collectors.');

		const [ IGN, AMOUNT_OR_TEXT, ...textInput ] = args;
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

		let amount = removeNumberFormatting(AMOUNT_OR_TEXT);
		let notes;

		if (/^\d+$/.test(amount)) {
			amount = Number(amount);
			notes = textInput.length ? textInput.join(' ') : null;
		} else {
			amount = 0;
			notes = [ AMOUNT_OR_TEXT, ...textInput ].join(' ');
		}

		await Promise.all(player.addTransfer({
			amount,
			collectedBy: collector.minecraftUUID,
			notes,
			type: 'donation',
		}));

		message.reply(`registered a donation from \`${player.ign}\` of \`${client.formatNumber(AMOUNT_OR_TEXT)}\`.`);

		client.log(new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
			.setTitle('Guild Donations')
			.addField(`/ah ${collector.ign}`, `\`\`\`\n${player.ign}: ${client.formatNumber(AMOUNT_OR_TEXT)} (manually)\`\`\``)
			.setTimestamp(),
		);
	}
};
