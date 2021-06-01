'use strict';

const { CronJob: CronJobConstructor } = require('cron');
const { stripIndents, commaLists } = require('common-tags');
const { Permissions } = require('discord.js');
const { isEqual } = require('lodash');
const { X_EMOJI, Y_EMOJI_ALT } = require('../../../constants/emojiCharacters');
const { DEFAULT_CONFIG } = require('../../../constants/database');
const { asyncFilter, safePromiseAll } = require('../../../functions/util');
const hypixel = require('../../../api/hypixel');
const ConfigManager = require('./ConfigManager');
const CronJobManager = require('./CronJobManager');
const HypixelGuildManager = require('./HypixelGuildManager');
const PlayerManager = require('./PlayerManager');
const TaxCollectorManager = require('./TaxCollectorManager');
const Config = require('../models/Config');
const CronJob = require('../models/CronJob');
const HypixelGuild = require('../models/HypixelGuild');
const Player = require('../models/Player');
const TaxCollector = require('../models/TaxCollector');
const logger = require('../../../functions/logger');


module.exports = class DatabaseManager {
	/**
	 * @param {object} param0
	 * @param {import('../../LunarClient')} param0.client
	 * @param {object} db
	 */
	constructor({ client, db }) {
		this.client = client;

		this.modelManagers = {
			config: new ConfigManager({ client, model: Config }),
			cronJobs: new CronJobManager({ client, model: CronJob }),
			hypixelGuilds: new HypixelGuildManager({ client, model: HypixelGuild }),
			players: new PlayerManager({ client, model: Player }),
			taxCollectors: new TaxCollectorManager({ client, model: TaxCollector }),
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
		const { config } = this.modelManagers;

		this.client.schedule('updatePlayerDatabase', new CronJobConstructor({
			cronTime: `0 0/${config.get('DATABASE_UPDATE_INTERVAL')} * * * *`,
			onTick: () => config.getBoolean('PLAYER_DB_UPDATE_ENABLED') && this.update(),
			start: true,
		}));

		// update hypixelGuilds if next scheduled update is over 1 min from now
		if (config.getBoolean('PLAYER_DB_UPDATE_ENABLED')) {
			const INTERVAL = config.get('DATABASE_UPDATE_INTERVAL');
			if (INTERVAL - (new Date().getMinutes() % INTERVAL) > 1) this.modelManagers.hypixelGuilds.update();
		}

		this.modelManagers.players.scheduleXpResets();

		this.modelManagers.hypixelGuilds.scheduleDailyStatsSave();
	}

	/**
	 * initialises the database and cache
	 */
	async init() {
		await this.loadCache();
		await Promise.all(Object.entries(DEFAULT_CONFIG).map(async ([ key, value ]) => (this.modelManagers.config.get(key) !== null ? null : this.modelManagers.config.set(key, value))));
	}

	/**
	 * loads all db caches (performs a sweep first)
	 */
	async loadCache() {
		return Promise.all(
			Object.values(this.modelManagers).map(async manager => manager.loadCache()),
		);
	}

	/**
	 * sweeps all db caches
	 */
	sweepCache() {
		for (const handler of Object.values(this.modelManagers)) {
			handler.sweepCache();
		}
	}

	/**
	 * false if the auctionID is already in the transactions db, true if not
	 * @param {string} auctionID
	 */
	async _validateAuctionID(auctionID) {
		try {
			await this.models.Transaction.findOne({
				where: { auctionID },
				rejectOnEmpty: true, // rejects the promise if nothing was found
				raw: true, // to not parse an eventual result
			});
			return false;
		} catch {
			return true;
		}
	}

	/**
	 * updates the tax database
	 * @returns {Promise<string[]>}
	 */
	async _updateTaxDatabase() {
		const { config, players, taxCollectors } = this.modelManagers;
		const TAX_AUCTIONS_START_TIME = config.getNumber('TAX_AUCTIONS_START_TIME');
		const TAX_AMOUNT = config.getNumber('TAX_AMOUNT');
		const TAX_AUCTIONS_ITEMS = config.getArray('TAX_AUCTIONS_ITEMS');
		const NOW = Date.now();
		const availableAuctionsLog = [];
		const taxPaidLog = [];

		let auctionsAmount = 0;
		let unknownPlayers = 0;

		// update db
		await Promise.all(taxCollectors.activeCollectors.map(async (taxCollector) => {
			try {
				const auctions = await hypixel.skyblock.auction.player(taxCollector.minecraftUUID);
				const taxAuctions = [];
				const paidLog = [];

				let availableAuctions = 0;

				for (const auction of await asyncFilter(
					auctions,
					auc => TAX_AUCTIONS_ITEMS.includes(auc.item_name) && auc.start >= TAX_AUCTIONS_START_TIME && this._validateAuctionID(auc.uuid), // correct item & started after last reset & no outbid from already logged auction
				)) auction.highest_bid_amount >= TAX_AMOUNT
					? auction.bids.length && taxAuctions.push(auction)
					: auction.end > NOW && ++availableAuctions;

				availableAuctionsLog.push(`\u200b > ${taxCollector.ign}: ${availableAuctions}`);

				if (auctions.meta.cached) return logger.info(`[UPDATE TAX DB]: ${taxCollector.ign}: cached data`);

				auctionsAmount += taxAuctions.length;

				await safePromiseAll(taxAuctions.map(async (auction) => {
					const { bidder, amount } = auction.bids[auction.bids.length - 1];
					const player = players.cache.get(bidder);

					if (!player) return ++unknownPlayers;

					paidLog.push(`${player.ign}: ${amount.toLocaleString(config.get('NUMBER_FORMAT'))}`);
					if (config.getBoolean('EXTENDED_LOGGING_ENABLED')) logger.info(`[UPDATE TAX DB]: ${player.ign} [uuid: ${bidder}] paid ${amount.toLocaleString(config.get('NUMBER_FORMAT'))} at /ah ${taxCollector.ign} [auctionID: ${auction.uuid}]`);

					return player.setToPaid({
						amount,
						collectedBy: taxCollector.minecraftUUID,
						auctionID: auction.uuid,
						shouldAdd: true,
					});
				}));

				if (!paidLog.length) return;

				taxPaidLog.push({
					name: `/ah ${taxCollector.ign}`,
					value: `\`\`\`\n${paidLog.join('\n')}\`\`\`` },
				);
			} catch (error) {
				logger.error(`[UPDATE TAX DB]: ${taxCollector.ign}`, error);
				availableAuctionsLog.push(`\u200b > ${taxCollector.ign}: API Error`);
			}
		}));

		// logging
		if (auctionsAmount && (config.getBoolean('EXTENDED_LOGGING_ENABLED') || (unknownPlayers && new Date().getMinutes() < config.getNumber('DATABASE_UPDATE_INTERVAL')))) {
			logger.info(`[UPDATE TAX DB]: New auctions: ${auctionsAmount}, unknown players: ${unknownPlayers}`);
		}

		if (taxPaidLog.length) {
			this.client.log(this.client.defaultEmbed
				.setTitle('Guild Tax')
				.addFields(...taxPaidLog),
			);
		}

		return availableAuctionsLog
			.sort((a, b) => a.split(':')[0].toLowerCase().localeCompare(b.split(':')[0].toLowerCase())) // alphabetically
			.sort((a, b) => Number(b.split(':')[1]) - Number(a.split(':')[1])); // number of auctions
	}

	/**
	 * creates and returns a tax embed
	 * @param {?string[]} availableAuctionsLog
	 */
	createTaxEmbed(availableAuctionsLog = null) {
		const { config, hypixelGuilds, players, taxCollectors } = this.modelManagers;
		const activeTaxCollectors = taxCollectors.activeCollectors; // eslint-disable-line no-shadow
		const playersInGuild = players.inGuild;
		const PLAYER_COUNT = playersInGuild.size;
		const PAID_COUNT = playersInGuild.filter(({ paid }) => paid).size;
		const TOTAL_COINS = taxCollectors.cache.reduce((acc, { collectedTax }) => acc + collectedTax, 0);
		const taxEmbed = this.client.defaultEmbed
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
			.setFooter('Last updated at');

		// add guild specific fields
		for (const hypixelGuild of hypixelGuilds.cache.values()) {
			const GUILD_PLAYER_COUNT = hypixelGuild.playerCount;
			const ENTRIES_PER_ROW = Math.ceil(GUILD_PLAYER_COUNT / 3);
			const values = [ '', '', '' ];

			// construct player list in three rows: paid emoji + non line-breaking space + player ign, slice to keep everything in one line
			if (config.getBoolean('TAX_TRACKING_ENABLED')) {
				for (const [ index, player ] of hypixelGuild.players.array().entries()) values[Math.floor(index / ENTRIES_PER_ROW)] += `\n${player.paid ? Y_EMOJI_ALT : X_EMOJI}\xa0${player.ign.slice(0, 15)}`;
			} else {
				for (const [ index, player ] of hypixelGuild.players.array().entries()) values[Math.floor(index / ENTRIES_PER_ROW)] += `\n•\xa0${player.ign.slice(0, 15)}`;
			}

			// add rows to tax embed
			for (const [ index, value ] of values.entries()) {
				let paddedValue = value;

				// fill up with empty lines if rows have different size
				for (let emptyLine = ENTRIES_PER_ROW - (paddedValue.match(/\n/g)?.length ?? 0) + 1; --emptyLine;) {
					paddedValue += '\n\u200b';
				}

				taxEmbed.addField(
					index % 2
						? `${hypixelGuild.name} (${GUILD_PLAYER_COUNT})`
						: '\u200b',
					`\`\`\`\n${paddedValue}\`\`\``, // put everything in a code block
					true,
				);
			}
		}

		return taxEmbed;
	}

	/**
	 * updates the player database and the corresponding tax message
	 * @param {import('../../LunarClient')} client
	 */
	async update() {
		const { config, players } = this.modelManagers;

		// the hypxiel api encountered an error before
		if (this.client.config.getBoolean('HYPIXEL_API_ERROR')) {
			// reset error every full hour
			if (new Date().getMinutes() >= this.client.config.getNumber('DATABASE_UPDATE_INTERVAL')) return logger.warn('[DB UPDATE]: auto updates disabled');

			this.client.config.set('HYPIXEL_API_ERROR', false);
		}

		// update player db
		await this.modelManagers.hypixelGuilds.update();

		// update tax db
		const availableAuctionsLog = config.getBoolean('TAX_TRACKING_ENABLED')
			? await this._updateTaxDatabase()
			: null;

		// update Xp
		if (config.getBoolean('XP_TRACKING_ENABLED')) players.updateXp();

		await players.updateIGN();

		// update taxMessage
		const taxChannel = this.client.channels.cache.get(config.get('TAX_CHANNEL_ID'));

		if (!taxChannel?.guild?.available) return logger.warn('[TAX MESSAGE]: channel not found');
		if (!taxChannel.botPermissions.has([ Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES, Permissions.FLAGS.EMBED_LINKS ])) return logger.warn('[TAX MESSAGE]: missing permission to edit taxMessage');

		const taxEmbed = this.createTaxEmbed(availableAuctionsLog);

		let taxMessage = await taxChannel.messages.fetch(config.get('TAX_MESSAGE_ID')).catch(error => logger.error('[TAX MESSAGE]', error));

		if (!taxMessage || taxMessage.deleted) { // taxMessage deleted
			taxMessage = await taxChannel.send(taxEmbed).catch(error => logger.error('[TAX MESSAGE]', error));

			if (!taxMessage) return; // failed to retreive old and send new taxMessage

			config.set('TAX_MESSAGE_ID', taxMessage.id);
			return logger.info('[TAX MESSAGE]: created new taxMessage');
		}
		if (taxMessage.embeds[0]?.description === taxEmbed.description && isEqual(taxMessage.embeds[0].fields, taxEmbed.fields)) return; // no changes to taxMessage

		try {
			await taxMessage.edit(taxMessage.content, taxEmbed);
			logger.info('[TAX MESSAGE]: updated taxMessage');
		} catch (error) {
			logger.error('[TAX MESSAGE]', error);
		}
	}
};
