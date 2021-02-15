'use strict';

const { CronJob: CronJobConstructor } = require('cron');
const { stripIndents, commaLists } = require('common-tags');
const { MessageEmbed } = require('discord.js');
const _ = require('lodash');
const { X_EMOJI, Y_EMOJI_ALT } = require('../../constants/emojiCharacters');
const hypixel = require('../../api/hypixel');
const BannedUserHandler = require('./BannedUserHandler');
const ConfigHandler = require('./ConfigHandler');
const CronJobHandler = require('./CronJobHandler');
const HypixelGuildHandler = require('./HypixelGuildHandler');
const PlayerHandler = require('./PlayerHandler');
const TaxCollectorHandler = require('./TaxCollectorHandler');
const BannedUser = require('./models/BannedUser');
const Config = require('./models/Config');
const CronJob = require('./models/CronJob');
const HypixelGuild = require('./models/HypixelGuild');
const Player = require('./models/Player');
const TaxCollector = require('./models/TaxCollector');
const logger = require('../../functions/logger');


class DatabaseHandler {
	/**
	 * @param {object} param0
	 * @param {import('../LunarClient')} param0.client
	 * @param {object} db
	 */
	constructor({ client, db }) {
		this.client = client;

		this.handlers = {
			bannedUsers: new BannedUserHandler({ client, model: BannedUser }),
			config: new ConfigHandler({ client, model: Config }),
			cronJobs: new CronJobHandler({ client, model: CronJob }),
			hypixelGuilds: new HypixelGuildHandler({ client, model: HypixelGuild }),
			players: new PlayerHandler({ client, model: Player }),
			taxCollectors: new TaxCollectorHandler({ client, model: TaxCollector }),
		};

		const models = {};

		for (const [ key, value ] of Object.entries(db)) {
			if (Object.getPrototypeOf(value) === db.Sequelize.Model) {
				models[key] = value;
				Object.defineProperty(value.prototype, 'client', { value: client }); // add 'client' to all db models
			} else {
				this[key] = value;
			}
		}

		this.models = models;
	}

	/**
	 * update player database and tax message every x min starting at the full hour
	 */
	schedule() {
		const { config } = this.handlers;

		this.client.schedule('updatePlayerDatabase', new CronJobConstructor({
			cronTime: `0 0/${config.get('DATABASE_UPDATE_INTERVAL')} * * * *`,
			onTick: () => config.getBoolean('PLAYER_DB_UPDATE_ENABLED') && this.update(),
			start: true,
		}));

		this.handlers.players.scheduleXpResets();
	}

	/**
	 * loads all db caches (performs a sweep first)
	 */
	async loadCache() {
		return Promise.all(
			Object.values(this.handlers).map(async handler => handler.loadCache()),
		);
	}

	/**
	 * sweeps all db caches
	 */
	sweepCache() {
		for (const handler of Object.values(this.handlers)) {
			handler.sweepCache();
		}
	}

	/**
	 * updates the tax database
	 * @returns {Promise<string[]>}
	 */
	async _updateTaxDatabase() {
		const { config, players, taxCollectors } = this.handlers;
		const TAX_AUCTIONS_START_TIME = config.getNumber('TAX_AUCTIONS_START_TIME');
		const TAX_AMOUNT = config.getNumber('TAX_AMOUNT');
		const TAX_AUCTIONS_ITEMS = config.getArray('TAX_AUCTIONS_ITEMS');
		const NOW = Date.now();
		const ignoredAuctions = players.ignoredAuctions;
		const availableAuctionsLog = [];
		const loggingEmbed = new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
			.setTitle('Guild Tax')
			.setTimestamp();

		let auctionsAmount = 0;
		let unknownPlayers = 0;

		// update db
		await Promise.all(taxCollectors.activeCollectors
			.map(async taxCollector => {
				const auctions = await hypixel.skyblock.auction.player(taxCollector.minecraftUUID).catch(error => logger.error(`[UPDATE TAX DB]: ${taxCollector.ign}: ${error.name}${error.code ? ` ${error.code}` : ''}: ${error.message}`));

				if (!auctions) return availableAuctionsLog.push(`\u200b > ${taxCollector.ign}: API Error`);

				const taxAuctions = [];
				const paidLog = [];

				let availableAuctions = 0;

				auctions
					.filter(auction => TAX_AUCTIONS_ITEMS.includes(auction.item_name) && !ignoredAuctions.includes(auction.uuid) && auction.start >= TAX_AUCTIONS_START_TIME) // correct item & no outbid & started after last reset
					.forEach(auction => auction.highest_bid_amount >= TAX_AMOUNT
						? auction.bids.length && taxAuctions.push(auction)
						: auction.end > NOW && ++availableAuctions,
					);

				availableAuctionsLog.push(`\u200b > ${taxCollector.ign}: ${availableAuctions}`);

				if (auctions.meta.cached) return logger.info(`[UPDATE TAX DB]: ${taxCollector.ign}: cached data`);

				auctionsAmount += taxAuctions.length;

				taxAuctions.forEach(auction => {
					const { bidder, amount } = auction.bids[auction.bids.length - 1];
					const player = players.cache.get(bidder);

					if (!player) return ++unknownPlayers;

					paidLog.push(`${player.ign}: ${amount.toLocaleString(config.get('NUMBER_FORMAT'))}`);
					if (config.getBoolean('EXTENDED_LOGGING')) logger.info(`[UPDATE TAX DB]: ${player.ign} [uuid: ${bidder}] paid ${amount.toLocaleString(config.get('NUMBER_FORMAT'))} at /ah ${taxCollector.ign} [auctionID: ${auction.uuid}]`);

					player.setToPaid({
						amount,
						collectedBy: taxCollector.minecraftUUID,
						auctionID: auction.uuid,
						shouldAdd: true,
					});
				});

				if (!paidLog.length) return;

				loggingEmbed.addField(`/ah ${taxCollector.ign}`, `\`\`\`\n${paidLog.join('\n')}\`\`\``);
			}),
		).catch(error => logger.error(`[UPDATE TAX DB]: ${error.name}: ${error.message}`));

		// logging
		if (auctionsAmount && (config.getBoolean('EXTENDED_LOGGING') || (unknownPlayers && new Date().getMinutes() < config.getNumber('DATABASE_UPDATE_INTERVAL')))) logger.info(`[UPDATE TAX DB]: New auctions: ${auctionsAmount}, unknown players: ${unknownPlayers}`);
		if (loggingEmbed.fields.length) this.client.log(loggingEmbed);

		return availableAuctionsLog
			.sort((a, b) => a.split(':')[0].toLowerCase().localeCompare(b.split(':')[0].toLowerCase())) // alphabetically
			.sort((a, b) => Number(b.split(':')[1]) - Number(a.split(':')[1])); // number of auctions
	}

	/**
	 * creates and returns a tax embed
	 * @param {?string[]} availableAuctionsLog
	 */
	createTaxEmbed(availableAuctionsLog = null) {
		const { config, hypixelGuilds, players, taxCollectors } = this.handlers;
		const activeTaxCollectors = taxCollectors.activeCollectors; // eslint-disable-line no-shadow
		const PLAYER_COUNT = players.size;
		const PAID_COUNT = players.cache.filter(player => player.paid).size;
		const TOTAL_COINS = taxCollectors.cache.reduce((acc, taxCollector) => acc + taxCollector.collectedAmount, 0);
		const taxEmbed = new MessageEmbed()
			.setColor(config.get('EMBED_BLUE'))
			.setTitle('Guild Tax')
			.setDescription(stripIndents(commaLists`
				\`\`\`cs
				Collectors: # /ah ${activeTaxCollectors.map(player => player.ign).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))}
				Amount: ${config.getNumber('TAX_AMOUNT').toLocaleString(config.get('NUMBER_FORMAT'))}
				Items: ${config.getArray('TAX_AUCTIONS_ITEMS').map(item => `'${item}'`)}
				Paid: ${PAID_COUNT} / ${PLAYER_COUNT} | ${Math.round((PAID_COUNT / PLAYER_COUNT) * 100)} % | collected amount: ${TOTAL_COINS.toLocaleString(config.get('NUMBER_FORMAT'))} coins
				Available auctions:
				${availableAuctionsLog?.join('\n') ?? '\u200b -'}
				\`\`\`
			`))
			.setFooter('Last updated at')
			.setTimestamp();

		// add guild specific fields
		hypixelGuilds.cache.forEach(hypixelGuild => {
			const GUILD_PLAYER_COUNT = hypixelGuild.playerCount;
			const ENTRIES_PER_ROW = Math.ceil(GUILD_PLAYER_COUNT / 3);
			const values = [ '', '', '' ];

			let index = -1;

			// construct player list in three rows: paid emoji + non line-breaking space + player ign, slice to keep everything in one line
			if (config.getBoolean('TAX_TRACKING_ENABLED')) {
				hypixelGuild.players.forEach(player => values[Math.floor(++index / ENTRIES_PER_ROW)] += `\n${player.paid ? Y_EMOJI_ALT : X_EMOJI}\xa0${player.ign.slice(0, 15)}`);
			} else {
				hypixelGuild.players.forEach(player => values[Math.floor(++index / ENTRIES_PER_ROW)] += `\n•\xa0${player.ign.slice(0, 15)}`);
			}

			// add rows to tax embed
			values.forEach((value, fieldIndex) => {
				// fill up with empty lines if rows have different size
				for (let emptyLine = ENTRIES_PER_ROW - (value.match(/\n/g)?.length ?? 0) + 1; --emptyLine;) {
					value += '\n\u200b';
				}

				taxEmbed.addField(
					fieldIndex % 2
						? `${hypixelGuild.name} (${GUILD_PLAYER_COUNT})`
						: '\u200b',
					`\`\`\`\n${value}\`\`\``, // put everything in a code block
					true,
				);
			});
		});

		return taxEmbed;
	}

	/**
	 * updates the player database and the corresponding tax message
	 * @param {import('../structures/LunarClient')} client
	 */
	async update() {
		const { config, players } = this.handlers;

		// update player db
		await this.client.hypixelGuilds.update();

		// update tax db
		const availableAuctionsLog = config.getBoolean('TAX_TRACKING_ENABLED') && await this._updateTaxDatabase();

		// update Xp
		if (config.getBoolean('XP_TRACKING_ENABLED')) players.update();

		// update taxMessage
		const taxChannel = this.client.channels.cache.get(config.get('TAX_CHANNEL_ID'));

		if (!taxChannel?.guild?.available) return logger.warn('[TAX MESSAGE]: channel not found');
		if (!taxChannel.checkBotPermissions(['VIEW_CHANNEL', 'SEND_MESSAGES', 'EMBED_LINKS'])) return logger.warn('[TAX MESSAGE]: missing permission to edit taxMessage');

		const taxEmbed = this.createTaxEmbed(availableAuctionsLog);

		let taxMessage = await taxChannel.messages.fetch(config.get('TAX_MESSAGE_ID')).catch(error => logger.error(`[TAX MESSAGE]: ${error.name}: ${error.message}`));

		if (!taxMessage || taxMessage.deleted) { // taxMessage deleted
			taxMessage = await taxChannel.send(taxEmbed).catch(error => logger.error(`[TAX MESSAGE]: ${error.name}: ${error.message}`));

			if (!taxMessage) return; // failed to retreive old and send new taxMessage

			config.set('TAX_MESSAGE_ID', taxMessage.id);
			return logger.info('[TAX MESSAGE]: created new taxMessage');
		}
		if (taxMessage.embeds[0]?.description === taxEmbed.description && _.isEqual(taxMessage.embeds[0].fields, taxEmbed.fields)) return; // no changes to taxMessage

		const { content } = taxMessage;

		taxMessage.edit(content, taxEmbed).then(
			() => logger.info('[TAX MESSAGE]: updated taxMessage'),
			error => logger.error(`[TAX MESSAGE]: ${error.name}: ${error.message}`),
		);
	}
}

module.exports = DatabaseHandler;
