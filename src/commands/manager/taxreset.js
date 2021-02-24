'use strict';

const { MessageEmbed } = require('discord.js');
const Command = require('../../structures/commands/Command');
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
	 * @param {import('../../structures/LunarClient')} client
	 * @param {import('../../structures/database/ConfigHandler')} config
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(client, config, message, args, flags, rawArgs) {
		const { db, players, taxCollectors } = client;

		let currentTaxEmbed;
		let currentTaxCollectedEmbed;
		let result;

		// individual player
		if (args.length) {
			/**
			 * @type {import('../../structures/database/models/Player')}
			 */
			const player = (message.mentions.users.size
				? players.getByID(message.mentions.users.first().id)
				: players.getByIGN(args[0]))
				?? await players.model.findOne({
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

			const OLD_AMOUNT = await player.taxAmount;

			if (!flags.some(flag => [ 'f', 'force' ].includes(flag))) {
				const ANSWER = await message.awaitReply(`reset tax paid from \`${player.ign}\` (amount: ${client.formatNumber(OLD_AMOUNT)})? Warning, this action cannot be undone.`, 30);

				if (!config.getArray('REPLY_CONFIRMATION').includes(ANSWER?.toLowerCase())) return message.reply('the command has been cancelled.');
			}

			await player.resetTax();

			result = `reset tax paid from \`${player.ign}\` (amount: ${client.formatNumber(OLD_AMOUNT)})`;

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

			if (!currentTaxEmbed) {
				if (!flags.some(flag => [ 'f', 'force' ].includes(flag))) {
					const ANSWER = await message.awaitReply(`unable to retrieve the current tax embed from ${client.lgGuild?.channels.cache.get(config.get('TAX_CHANNEL_ID')) ?? '#guild-tax'} to log it. Create a new one and continue?`, 30);

					if (!config.getArray('REPLY_CONFIRMATION').includes(ANSWER?.toLowerCase())) return message.reply('the command has been cancelled.');
				}

				currentTaxEmbed = client.db.createTaxEmbed();
			}

			currentTaxCollectedEmbed = taxCollectors.createTaxCollectedEmbed();


			// update database
			await Promise.all([
				...taxCollectors.cache.map(async taxCollector => { // remove retired collectors
					if (taxCollector.isCollecting) {
						taxCollector.resetAmount('tax');
					} else {
						taxCollector.remove();
					}
				}),
				players.model.prototype.update( // reset players that left
					{ paid: false },
					{
						where: {
							guildID: null,
							paid: true,
						},
					},
				),
				...players.cache.map(async player => { // reset current players
					player.paid = false;
					return player.save();
				}),
				config.set('TAX_AUCTIONS_START_TIME', Date.now()), // ignore all auctions up untill now
			]);

			// delete players who left the guild
			players.sweepDb();

			result = 'reset the tax database. All auctions up untill now will be ignored';
		}

		// logging
		client
			.log(
				currentTaxEmbed,
				currentTaxCollectedEmbed,
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
