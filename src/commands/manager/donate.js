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
			usage: '[`IGN`|`@mention`] [`amount`]',
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
		if (args.length !== 2) return message.reply(this.usageInfo);

		const { players } = client;
		const collector = client.taxCollectors.getByID(message.author.id);

		if (!collector?.isCollecting) return message.reply('this command is restricted to tax collectors.');

		const IGN = args[0];
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

		const AMOUNT = Number(removeNumberFormatting(args[1]));

		if (isNaN(AMOUNT) || !isFinite(AMOUNT)) return message.reply(`\`${args[1]}\` is not a valid number.`);

		await Promise.all(player.addTransfer({
			amount: AMOUNT,
			collectedBy: collector.minecraftUUID,
			type: 'donation',
		}));

		message.reply(`registered a donation from \`${player.ign}\` of \`${client.formatNumber(AMOUNT)}\`.`);

		client.log(new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
			.setTitle('Guild Donations')
			.addField(`/ah ${collector.ign}`, `\`\`\`\n${player.ign}: ${client.formatNumber(AMOUNT)} (manually)\`\`\``)
			.setTimestamp(),
		);
	}
};
