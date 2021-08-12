'use strict';

const { Permissions, Formatters } = require('discord.js');
const { CronJob: CronJobConstructor } = require('cron');
const { stripIndents, commaLists } = require('common-tags');
const { isEqual } = require('lodash');
const { X_EMOJI, Y_EMOJI_ALT } = require('../../../constants/emojiCharacters');
const { DEFAULT_CONFIG } = require('../../../constants/database');
const { asyncFilter, safePromiseAll } = require('../../../functions/util');
const hypixel = require('../../../api/hypixel');
const ConfigManager = require('./ConfigManager');
const HypixelGuildManager = require('./HypixelGuildManager');
const PlayerManager = require('./PlayerManager');
const TaxCollectorManager = require('./TaxCollectorManager');
const Config = require('../models/Config');
const HypixelGuild = require('../models/HypixelGuild');
const Player = require('../models/Player');
const TaxCollector = require('../models/TaxCollector');
const ModelManager = require('./ModelManager');
const ChatTrigger = require('../models/ChatTrigger');
const ArrayCacheCollection = require('../../ArrayCacheCollection');
const ChannelUtil = require('../../../util/ChannelUtil');
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
			hypixelGuilds: new HypixelGuildManager({ client, model: HypixelGuild }),
			players: new PlayerManager({ client, model: Player, CacheCollection: ArrayCacheCollection }),
			taxCollectors: new TaxCollectorManager({ client, model: TaxCollector }),
			chatTriggers: new ModelManager({ client, model: ChatTrigger }),
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
			onTick: () => config.get('PLAYER_DB_UPDATE_ENABLED') && this.update(),
			start: true,
		}));

		// schedule guild stats channel update
		this.client.schedule('guildStatsChannelUpdate', new CronJobConstructor({
			cronTime: '0 0 * * * *',
			onTick: async () => {
				if (!config.get('AVERAGE_STATS_CHANNEL_UPDATE_ENABLED')) return;

				const { mainGuild } = this.modelManagers.hypixelGuilds;

				if (!mainGuild) return;

				const { formattedStats } = mainGuild;

				if (!formattedStats) return;

				try {
					for (const type of [ 'weight', 'skill', 'slayer', 'catacombs' ]) {
					/**
					 * @type {import('discord.js').VoiceChannel}
					 */
						const channel = this.client.channels.cache.get(config.get(`${type}_AVERAGE_STATS_CHANNEL_ID`));

						if (!channel) { // no channel found
							logger.warn(`[GUILD STATS CHANNEL UPDATE]: ${type}: no channel found`);
							continue;
						}

						const newName = `${type} avg: ${formattedStats[`${type}Average`]}`;
						const { name: oldName } = channel;

						if (newName === oldName) continue; // no update needed

						if (!channel.editable) {
							logger.error(`[GUILD STATS CHANNEL UPDATE]: ${channel.name}: missing permissions to edit`);
							continue;
						}

						await channel.setName(newName, `synced with ${mainGuild.name}'s average stats`);

						logger.info(`[GUILD STATS CHANNEL UPDATE]: '${oldName}' -> '${newName}'`);
					}
				} catch (error) {
					logger.error('[GUILD STATS CHANNEL UPDATE]', error);
				}
			},
			start: true,
		}));

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
	 * false if the auctionId is already in the transactions db, true if not
	 * @param {string} auctionId
	 */
	async #validateAuctionId(auctionId) {
		try {
			await this.models.Transaction.findOne({
				where: { auctionId },
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
	async #updateTaxDatabase() {
		const { config, players, taxCollectors } = this.modelManagers;
		const TAX_AUCTIONS_START_TIME = config.get('TAX_AUCTIONS_START_TIME');
		const TAX_AMOUNT = config.get('TAX_AMOUNT');
		const TAX_AUCTIONS_ITEMS = config.get('TAX_AUCTIONS_ITEMS');
		const NOW = Date.now();
		const availableAuctionsLog = [];
		const taxPaidLog = [];

		let auctionsAmount = 0;
		let unknownPlayers = 0;

		// update db
		await Promise.all(taxCollectors.activeCollectors.map(async (taxCollector) => {
			try {
				const auctions = await hypixel.skyblock.auction.player(taxCollector.minecraftUuid);
				const taxAuctions = [];
				const paidLog = [];

				let availableAuctions = 0;

				for (const auction of await asyncFilter(
					auctions,
					auc => TAX_AUCTIONS_ITEMS.includes(auc.item_name) && auc.start >= TAX_AUCTIONS_START_TIME && this.#validateAuctionId(auc.uuid), // correct item & started after last reset & no outbid from already logged auction
				)) auction.highest_bid_amount >= TAX_AMOUNT
					? auction.bids.length && taxAuctions.push(auction)
					: auction.end > NOW && ++availableAuctions;

				availableAuctionsLog.push(`\u200b > ${taxCollector}: ${availableAuctions}`);

				if (auctions.meta.cached) return logger.info(`[UPDATE TAX DB]: ${taxCollector}: cached data`);

				auctionsAmount += taxAuctions.length;

				await safePromiseAll(taxAuctions.map(async (auction) => {
					const { bidder, amount } = auction.bids.at(-1);
					const player = players.cache.get(bidder);

					if (!player) return ++unknownPlayers;

					paidLog.push(`${player}: ${this.client.formatNumber(amount)}`);
					if (config.get('EXTENDED_LOGGING_ENABLED')) logger.info(`[UPDATE TAX DB]: ${player} [uuid: ${bidder}] paid ${this.client.formatNumber(amount)} at /ah ${taxCollector} [auctionId: ${auction.uuid}]`);

					return player.setToPaid({
						amount,
						collectedBy: taxCollector.minecraftUuid,
						auctionId: auction.uuid,
						shouldAdd: true,
					});
				}));

				if (!paidLog.length) return;

				taxPaidLog.push({
					name: `/ah ${taxCollector}`,
					value: Formatters.codeBlock(paidLog.join('\n')),
				});
			} catch (error) {
				logger.error(`[UPDATE TAX DB]: ${taxCollector}`, error);
				availableAuctionsLog.push(`\u200b > ${taxCollector}: API Error`);
			}
		}));

		// logging
		if (auctionsAmount && (config.get('EXTENDED_LOGGING_ENABLED') || (unknownPlayers && new Date().getMinutes() < config.get('DATABASE_UPDATE_INTERVAL')))) {
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
			.setDescription(Formatters.codeBlock('cs', stripIndents(commaLists`
				Collectors: # /ah ${activeTaxCollectors.map(player => player.ign).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))}
				Amount: ${this.client.formatNumber(config.get('TAX_AMOUNT'))}
				Items: ${config.get('TAX_AUCTIONS_ITEMS').map(item => `'${item}'`)}
				Paid: ${PAID_COUNT} / ${PLAYER_COUNT} | ${Math.round((PAID_COUNT / PLAYER_COUNT) * 100)} % | collected amount: ${this.client.formatNumber(TOTAL_COINS)} coins
				Available auctions:
				${availableAuctionsLog?.join('\n') ?? '\u200b -'}
			`)))
			.setFooter('Last updated at');

		// add guild specific fields
		for (const hypixelGuild of hypixelGuilds.cache.values()) {
			const GUILD_PLAYER_COUNT = hypixelGuild.playerCount;
			const ENTRIES_PER_ROW = Math.ceil(GUILD_PLAYER_COUNT / 3);
			const values = [ '', '', '' ];

			// construct player list in three rows: paid emoji + non line-breaking space + player ign, slice to keep everything in one line
			if (config.get('TAX_TRACKING_ENABLED')) {
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

				taxEmbed.addFields({
					name: index % 2
						? `${hypixelGuild.name} (${GUILD_PLAYER_COUNT})`
						: '\u200b',
					value: Formatters.codeBlock(paddedValue),
					inline: true,
				});
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
		if (config.get('HYPIXEL_API_ERROR')) {
			// reset error every full hour
			if (new Date().getMinutes() >= config.get('DATABASE_UPDATE_INTERVAL')) return logger.warn('[DB UPDATE]: auto updates disabled');

			config.set('HYPIXEL_API_ERROR', false);
		}

		// update player db
		await this.modelManagers.hypixelGuilds.update({ syncRanks: true });

		// update tax db
		const availableAuctionsLog = config.get('TAX_TRACKING_ENABLED')
			? await this.#updateTaxDatabase()
			: null;

		// update Xp
		if (config.get('XP_TRACKING_ENABLED')) players.updateXp();

		await players.updateIGN();

		// update taxMessage
		/** @type {import('discord.js').TextChannel} */
		const taxChannel = this.client.channels.cache.get(config.get('TAX_CHANNEL_ID'));

		if (!taxChannel?.guild?.available) return logger.warn('[TAX MESSAGE]: channel not found');
		if (!ChannelUtil.botPermissions(taxChannel).has(Permissions.FLAGS.VIEW_CHANNEL | Permissions.FLAGS.SEND_MESSAGES | Permissions.FLAGS.EMBED_LINKS)) return logger.warn('[TAX MESSAGE]: missing permission to edit taxMessage');

		const taxEmbed = this.createTaxEmbed(availableAuctionsLog);
		const TAX_MESSAGE_ID = config.get('TAX_MESSAGE_ID');
		const taxMessage = TAX_MESSAGE_ID && await taxChannel.messages.fetch(TAX_MESSAGE_ID).catch(error => logger.error('[TAX MESSAGE]', error));

		if (!taxMessage?.me || taxMessage.deleted) { // taxMessage deleted
			try {
				const { id } = await taxChannel.send({
					embeds: [
						taxEmbed,
					],
				});

				config.set('TAX_MESSAGE_ID', id);
				return logger.info('[TAX MESSAGE]: created new taxMessage');
			} catch (error) {
				return logger.error('[TAX MESSAGE]', error);
			}
		}

		if (taxMessage.embeds[0]?.description === taxEmbed.description && isEqual(taxMessage.embeds[0].fields, taxEmbed.fields)) return; // no changes to taxMessage

		try {
			await taxMessage.edit({
				embeds: [
					taxEmbed,
				],
			});
			logger.info('[TAX MESSAGE]: updated taxMessage');
		} catch (error) {
			logger.error('[TAX MESSAGE]', error);
		}
	}
};
