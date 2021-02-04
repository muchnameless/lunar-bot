'use strict';

const { MessageEmbed } = require('discord.js');
const Command = require('../../structures/Command');
const logger = require('../../functions/logger');


module.exports = class MyCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'ah' ],
			description: 'add / remove a player as tax collector',
			args: true,
			usage: '[`add`|`remove`] [`IGN`|`@mention`]',
			cooldown: 1,
		});
	}

	async run(client, config, message, args, flags, rawArgs) {
		const { taxCollectors } = client;

		// identify input arguments
		let type = '';
		let ign = '';

		args.forEach(arg => /add|rem(?:ove)?/i.test(arg) ? type = arg.toLowerCase() : ign = arg);

		if (!type.length || !ign.length || args.length !== 2) return message.reply(`\`${config.get('PREFIX')}${this.aliases?.[0] ?? this.name}\` ${this.usage}`);

		const player = message.mentions.users.size
			? client.players.getByID(message.mentions.users.first().id)
			: client.players.getByIGN(ign);

		if (!player) return message.reply(`no player ${message.mentions.users.size
			? `linked to \`${message.guild
				? message.mentions.members.first().displayName
				: message.mentions.users.first().username
			}\``
			: `with the IGN \`${ign}\``
		} found.`);

		let log;

		switch (type) {
			case 'add':
				if (taxCollectors.get(player.minecraftUUID)?.isCollecting) return message.reply(`\`${player.ign}\` is already a tax collector.`);

				await taxCollectors.add(player);
				if (!player.paid) player.setToPaid(); // let collector collect their own tax if they have not paid already
				log = `\`${player.ign}\` is now a tax collector`;
				break;

			case 'rem':
			case 'remove': {
				const taxCollector = taxCollectors.get(player.minecraftUUID);

				if (!taxCollector?.isCollecting) return message.reply(`\`${player.ign}\` is not a tax collector.`);

				// remove self paid if only the collector paid the default amount at his own ah
				if (taxCollector.collectedAmount === config.getNumber('TAX_AMOUNT') && player.collectedBy === player.minecraftUUID) {
					logger.info(`[TAX AH]: ${player.ign}: removed and reset tax paid`);
					await player.resetTax();
					await taxCollector.remove();
				} else {
					taxCollector.isCollecting = false;
					taxCollector.save();
				}

				log = `\`${taxCollector.ign}\` is no longer a tax collector`;
				break;
			}

			default:
				return message.reply('specify wether to `add` or `remove` the tax collector.');
		}

		client.log(new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
			.setTitle('Guild Tax')
			.setDescription(log)
			.setTimestamp(),
		);

		return message.reply(`${log}.`);
	}
};
