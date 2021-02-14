'use strict';

const { MessageEmbed } = require('discord.js');
const { createTaxEmbed } = require('../../functions/database');
const ConfigCollection = require('../../structures/collections/ConfigCollection');
const LunarMessage = require('../../structures/extensions/Message');
const LunarClient = require('../../structures/LunarClient');
const Command = require('../../structures/Command');
const logger = require('../../functions/logger');


module.exports = class TaxResetCommand extends Command {
	constructor(data) {
		super(data, {
			aliases: [ 'resettax' ],
			description: 'reset the tax database',
			usage: 'no arguments to reset everyone\n<`IGN`|`@mention`> to reset individual tax paid',
			cooldown: 5,
		});
	}

	/**
	 * execute the command
	 * @param {LunarClient} client
	 * @param {ConfigCollection} config
	 * @param {LunarMessage} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(client, config, message, args, flags, rawArgs) {
		const { players, taxCollectors, db } = client;

		let currentTaxEmbed;
		let result;

		// individual player
		if (args.length) {
			const player = (message.mentions.users.size
				? players.getByID(message.mentions.users.first().id)
				: players.getByIGN(args[0]))
				?? await db.Player.findOne({
					where: {
						guildID: null,
						ign: { [db.Sequelize.Op.iLike]: `%${args[0]}%` },
					},
				});

			if (!player) return message.reply(`no player ${message.mentions.users.size
				? `linked to \`${message.guild
					? message.mentions.members.first().displayName
					: message.mentions.users.first().username
				}\``
				: `with the IGN \`${args[0]}\``
			} found.`);

			if (!player.paid) return message.reply(`\`${player.ign}\` is not set to paid.`);

			if (!flags.some(flag => [ 'f', 'force' ].includes(flag))) {
				const ANSWER = await message.awaitReply(`reset tax paid from \`${player.ign}\`? Warning, this action cannot be undone.`, 30);

				if (!config.getArray('REPLY_CONFIRMATION').includes(ANSWER?.toLowerCase())) return message.reply('the command has been cancelled.');
			}

			const { amount: OLD_AMOUNT } = player;

			await player.resetTax();

			result = `reset tax paid from \`${player.ign}\` (${OLD_AMOUNT.toLocaleString(config.get('NUMBER_FORMAT'))})`;

		// all players
		} else {
			if (!flags.some(flag => [ 'f', 'force' ].includes(flag))) {
				const ANSWER = await message.awaitReply('reset tax paid from all guild members? Warning, this action cannot be undone.', 30);

				if (!config.getArray('REPLY_CONFIRMATION').includes(ANSWER?.toLowerCase())) return message.reply('the command has been cancelled.');
			}

			// get current tax embed from #guild-tax channel
			currentTaxEmbed = await (async () => {
				const taxChannel = client.lgGuild?.channels.cache.get(config.get('TAX_CHANNEL_ID'));

				if (!taxChannel) return logger.warn('[TAX RESET] tax channel error');

				const taxMessage = await taxChannel.messages.fetch(config.get('TAX_MESSAGE_ID')).catch(logger.error);

				if (!taxMessage) return logger.warn('[TAX RESET] TAX_MESSAGE fetch error');

				return taxMessage.embeds[0];
			})();

			if (!currentTaxEmbed && !flags.some(flag => [ 'f', 'force' ].includes(flag))) {
				const ANSWER = await message.awaitReply(`unable to retrieve the current tax embed from ${client.lgGuild?.channels.cache.get(config.get('TAX_CHANNEL_ID')) ?? '#guild-tax'} to log it. Continue?`, 30);

				if (!config.getArray('REPLY_CONFIRMATION').includes(ANSWER?.toLowerCase())) return message.reply('the command has been cancelled.');

				currentTaxEmbed = createTaxEmbed(client);
			}

			// remove retired collectors
			await Promise.all(taxCollectors.map(async taxCollector => !taxCollector.isCollecting && taxCollector.remove()));

			const leftAndPaid = await client.db.Player.findAll({
				where: {
					guildID: null,
					paid: true,
				},
			});

			// update database
			await Promise.all(
				players.map(async player => taxCollectors.has(player.minecraftUUID)
					? player.setToPaid()
					: player.resetTax(),
				),
				leftAndPaid.map(async player => player.resetTax()),
			);

			// delete players who left the guild
			players.sweepDb();

			// ignore all auctions up untill now
			await config.set('TAX_AUCTIONS_START_TIME', Date.now());

			result = 'reset the tax database. All auctions up untill now will be ignored';
		}

		// logging
		client
			.log(
				currentTaxEmbed,
				new MessageEmbed()
					.setColor(config.get('EMBED_BLUE'))
					.setTitle('Guild Tax')
					.setDescription(`${message.author.tag} | ${message.author} ${result}`)
					.setTimestamp(),
			).then(async logMessage => {
				if (!currentTaxEmbed) return;
				if (!logMessage.channel.checkBotPermissions('MANAGE_MESSAGES')) return;

				const pinnedMessages = await logMessage.channel.messages.fetchPinned().catch(logger.error);
				if (pinnedMessages?.size >= 50) await pinnedMessages.last().unpin({ reason: 'reached max pin amount' }).then(
					() => logger.info('[TAX RESET]: unpinned old tax embed'),
					error => logger.error(`[TAX RESET]: error unpinning old tax embed: ${error.name}: ${error.message}`),
				);

				logMessage.pin({ reason: '#sheet-logs' }).catch(logger.error);
			}).catch(logger.error);

		message.reply(`${result}.`);
	}
};
