'use strict';

const { MessageEmbed } = require('discord.js');
const { stripIndent } = require('common-tags');
const Command = require('../../structures/commands/Command');
const mojang = require('../../api/mojang');
const logger = require('../../functions/logger');


module.exports = class MyCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'donations leaderboard',
			args: false,
			usage: '',
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
		// aquire donations from db
		const donations = await client.db.models.Transaction.findAll({
			where: { type: 'donation' },
		});

		// construct { donator: amount } object
		const reducedAmount = Object.fromEntries([ ...new Set(donations.map(d => d.from)) ].map(x => [ x, 0 ]));
		const reducedNotes = Object.fromEntries([ ...new Set(donations.map(d => d.from)) ].map(x => [ x, [] ]));

		// fill said object
		for (const { from, amount, notes } of donations) {
			reducedAmount[from] += amount;
			if (notes?.length) reducedNotes[from].push(notes);
		}

		// transform and prettify data
		const embed = new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
			.setTitle('Guild Donations')
			.setTimestamp();
		let totalAmount = 0;

		await Promise.all([ ...Object.entries(reducedAmount) ].sort(([_, a], [__, b]) => b - a).map(async ([ minecraftUUID, amount ], index) => {
			const IGN = client.players.cache.get(minecraftUUID)?.ign ?? (await mojang.getName(IGN).catch(logger.error)) ?? minecraftUUID;
			const notes = reducedNotes[minecraftUUID].join('\n');
			const inline = Boolean(notes);

			embed.addField('\u200b', stripIndent`
				\`\`\`ada
				#${`${index + 1}`.padStart(3, '0')} : ${IGN}
					 > ${client.formatNumber(amount)}
				\`\`\`
			`, inline);

			if (inline) {
				embed
					.addField('\u200b', notes, inline)
					.padFields();
			}

			totalAmount += amount;
		}));

		// create and send embed
		message.reply(embed.setDescription(`Total: ${client.formatNumber(totalAmount)}`));
	}
};
