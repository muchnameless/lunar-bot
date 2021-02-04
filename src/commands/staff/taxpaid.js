'use strict';

const { MessageEmbed } = require('discord.js');
const Command = require('../../structures/Command');
const logger = require('../../functions/logger');


module.exports = class MyCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'paid' ],
			description: 'manually set a player to paid',
			args: true,
			usage: () => `[\`IGN\`|\`@mention\`] <custom \`amount\` to overwrite the default of ${this.client.config.getNumber('TAX_AMOUNT').toLocaleString(this.client.config.get('NUMBER_FORMAT'))}>`,
			cooldown: 1,
		});
	}

	async run(client, config, message, args, flags, rawArgs) {
		const { players, taxCollectors } = client;
		const collector = taxCollectors.getByID(message.author.id);

		if (!collector?.isCollecting) return message.reply('this command is restricted to tax collectors.');

		const [ IGN, CUSTOM_AMOUNT ] = args;
		const player = message.mentions.users.size ? players.getByID(message.mentions.users.first().id) : players.getByIGN(IGN);

		if (!player) return message.reply(`no player ${message.mentions.users.size
			? `linked to \`${message.guild
				? message.mentions.members.first().displayName
				: message.mentions.users.first().username
			}\``
			: `with the IGN \`${IGN}\``
		} found.`);

		if (player.paid && !flags.some(flag => [ 'f', 'force' ].includes(flag))) {
			const ANSWER = await message.awaitReply(`\`${player.ign}\` is already set to paid with an amount of \`${client.formatNumber(player.amount)}\`. Overwrite this?`, 30);

			if (!config.getArray('REPLY_CONFIRMATION').includes(ANSWER?.toLowerCase())) return message.reply('the command has been cancelled.');
		}

		player.setToPaid({
			amount: /\D/.test(CUSTOM_AMOUNT) ? config.getNumber('TAX_AMOUNT') : Number(CUSTOM_AMOUNT),
			collectedBy: collector.minecraftUUID,
		});

		message.reply(`\`${player.ign}\` manually set to paid with ${/\D/.test(CUSTOM_AMOUNT) ? 'the default' : 'a custom'} amount of \`${client.formatNumber(player.amount)}\` by \`${collector.ign}\``);

		client.log(new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
			.setTitle('Guild Tax')
			.addField(`/ah ${collector.ign}`, `\`\`\`\n${player.ign}: ${client.formatNumber(player.amount)} (manually)\`\`\``)
			.setTimestamp(),
		);
	}
};
