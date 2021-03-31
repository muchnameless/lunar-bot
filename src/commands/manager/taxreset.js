'use strict';

const { MessageEmbed } = require('discord.js');
const { safePromiseAll } = require('../../functions/util');
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
	 * @param {import('../../structures/extensions/Message')} message message that triggered the command
	 * @param {string[]} args command arguments
	 * @param {string[]} flags command flags
	 * @param {string[]} rawArgs arguments and flags
	 */
	async run(message, args, flags, rawArgs) { // eslint-disable-line no-unused-vars
		const { db, players, taxCollectors } = this.client;

		let currentTaxEmbed;
		let currentTaxCollectedEmbed;
		let result;

		// individual player
		if (args.length) {
			/**
			 * @type {import('../../structures/database/models/Player')}
			 */
			const player = (message.mentions.users.size
				? message.mentions.users.first().player
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

			if (!this.force(flags)) {
				const ANSWER = await message.awaitReply(`reset tax paid from \`${player.ign}\` (amount: ${OLD_AMOUNT ? this.client.formatNumber(OLD_AMOUNT) : 'unknown'})? Warning, this action cannot be undone.`, 30);

				if (!this.config.getArray('REPLY_CONFIRMATION').includes(ANSWER?.toLowerCase())) return message.reply('the command has been cancelled.');
			}

			await player.resetTax();

			result = `reset tax paid from \`${player.ign}\` (amount: ${OLD_AMOUNT ? this.client.formatNumber(OLD_AMOUNT) : 'unknown'})`;

		// all players
		} else {
			if (!this.force(flags)) {
				const ANSWER = await message.awaitReply('reset tax paid from all guild members? Warning, this action cannot be undone.', 30);

				if (!this.config.getArray('REPLY_CONFIRMATION').includes(ANSWER?.toLowerCase())) return message.reply('the command has been cancelled.');
			}

			// get current tax embed from #guild-tax channel
			currentTaxEmbed = await (async () => {
				const taxChannel = this.client.lgGuild?.channels.cache.get(this.config.get('TAX_CHANNEL_ID'));

				if (!taxChannel) return logger.warn('[TAX RESET] tax channel error');

				const taxMessage = await taxChannel.messages.fetch(this.config.get('TAX_MESSAGE_ID')).catch(logger.error);

				if (!taxMessage) return logger.warn('[TAX RESET] TAX_MESSAGE fetch error');

				return taxMessage.embeds[0];
			})();

			if (!currentTaxEmbed) {
				if (!this.force(flags)) {
					const ANSWER = await message.awaitReply(`unable to retrieve the current tax embed from ${this.client.lgGuild?.channels.cache.get(this.config.get('TAX_CHANNEL_ID')) ?? '#guild-tax'} to log it. Create a new one and continue?`, 30);

					if (!this.config.getArray('REPLY_CONFIRMATION').includes(ANSWER?.toLowerCase())) return message.reply('the command has been cancelled.');
				}

				currentTaxEmbed = this.client.db.createTaxEmbed();
			}

			currentTaxCollectedEmbed = taxCollectors.createTaxCollectedEmbed();


			// update database
			await safePromiseAll([
				...taxCollectors.cache.map(async (taxCollector) => { // remove retired collectors and reset active ones
					if (!taxCollector.isCollecting) return taxCollector.remove();
					return safePromiseAll([
						taxCollector.resetAmount('tax'),
						taxCollector.resetAmount('donation'),
					]);
				}),
				this.client.db.Sequelize.Model.update.call(players.model, // reset players that left
					{ paid: false },
					{
						where: {
							guildID: null,
							paid: true,
						},
					},
				),
				...players.cache.map(async (player) => { // reset current players
					player.paid = false;
					return player.save();
				}),
				this.config.set('TAX_AUCTIONS_START_TIME', Date.now()), // ignore all auctions up until now
			]);

			await safePromiseAll(taxCollectors.cache.map(async ({ player }) => player?.setToPaid()));

			// delete players who left the guild
			players.sweepDb();

			result = 'reset the tax database. All auctions up until now will be ignored';
		}

		// logging
		this.client
			.log(
				currentTaxEmbed,
				currentTaxCollectedEmbed,
				new MessageEmbed()
					.setColor(this.config.get('EMBED_BLUE'))
					.setTitle('Guild Tax')
					.setDescription(`${message.author.tag} | ${message.author} ${result}`)
					.setTimestamp(),
			)
			.then(async (logMessage) => {
				if (!currentTaxEmbed) return;
				if (!logMessage.channel.checkBotPermissions('MANAGE_MESSAGES')) return;

				const pinnedMessages = await logMessage.channel.messages.fetchPinned().catch(logger.error);
				if (pinnedMessages?.size >= 50) await pinnedMessages.last()
					.unpin({ reason: 'reached max pin amount' })
					.then(
						() => logger.info('[TAX RESET]: unpinned old tax embed'),
						error => logger.error(`[TAX RESET]: error unpinning old tax embed: ${error.name}: ${error.message}`),
					);

				logMessage.pin({ reason: '#sheet-logs' }).catch(logger.error);
			})
			.catch(logger.error);

		message.reply(`${result}.`);
	}
};
