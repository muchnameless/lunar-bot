import { Permissions, Formatters } from 'discord.js';
import { CronJob as CronJobConstructor } from 'cron';
import { stripIndents, commaLists } from 'common-tags';
import pkg from 'sequelize';
const { Model } = pkg;
import { DEFAULT_CONFIG, X_EMOJI, Y_EMOJI_ALT } from '../../../constants/index.js';
import { hypixel } from '../../../api/hypixel.js';
import { ConfigManager } from './ConfigManager.js';
import { HypixelGuildManager } from './HypixelGuildManager.js';
import { PlayerManager } from './PlayerManager.js';
import { TaxCollectorManager } from './TaxCollectorManager.js';
import { Config } from '../models/Config.js';
import { HypixelGuild } from '../models/HypixelGuild.js';
import { Player } from '../models/Player.js';
import { TaxCollector } from '../models/TaxCollector.js';
import { ModelManager } from './ModelManager.js';
import { ChatTrigger } from '../models/ChatTrigger.js';
import { ChannelUtil } from '../../../util/index.js';
import { asyncFilter, compareAlphabetically, logger } from '../../../functions/index.js';


export class DatabaseManager {
	/**
	 * @param {{ client: import('../../LunarClient').LunarClient, db: import('../index') }} param0
	 */
	constructor({ client, db }) {
		this.client = client;

		this.modelManagers = {
			config: new ConfigManager({ client, model: Config }),
			hypixelGuilds: new HypixelGuildManager({ client, model: HypixelGuild }),
			players: new PlayerManager({ client, model: Player }),
			taxCollectors: new TaxCollectorManager({ client, model: TaxCollector }),
			chatTriggers: new ModelManager({ client, model: ChatTrigger }),
		};

		const models = {};

		for (const [ key, value ] of Object.entries(db)) {
			if (Object.getPrototypeOf(value) === Model) {
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
			onTick: () => config.get('PLAYER_DB_UPDATE_ENABLED') && this.updateData(),
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
		await this.loadCache(); // load caches

		// set default config
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
	 * updates the tax database, returns availableAuctions per taxCollector
	 */
	async #updateTaxDatabase() {
		const { config, players, taxCollectors } = this.modelManagers;
		const TAX_AUCTIONS_START_TIME = config.get('TAX_AUCTIONS_START_TIME');
		const TAX_AMOUNT = config.get('TAX_AMOUNT');
		const TAX_AUCTIONS_ITEMS = config.get('TAX_AUCTIONS_ITEMS');
		const availableAuctionsLog = [];
		const dbPromises = [];

		let apiError = false;

		// update db
		for (const taxCollector of taxCollectors.cache.values()) {
			if (!taxCollector.isCollecting) continue; // skip retired collectors

			if (apiError) { // skip the rest if an API error occurred
				availableAuctionsLog.push({
					ign: taxCollector.ign,
					auctions: 'API Error',
				});

				continue;
			}

			try {
				const auctions = await hypixel.skyblock.auction.player(taxCollector.minecraftUuid);

				// collector has no auctions in the API
				if (!auctions.length) {
					availableAuctionsLog.push({
						ign: taxCollector.ign,
						auctions: 0,
					});

					continue;
				}

				/** @type {import('@zikeji/hypixel').Components.Schemas.SkyBlockAuction[]} */
				const taxAuctions = [];

				let availableAuctions = 0;

				// filter auctions
				for (const auction of await asyncFilter(
					auctions,
					// correct item & started after last reset & no outbid from already logged auction
					auc => TAX_AUCTIONS_ITEMS.includes(auc.item_name) && auc.start >= TAX_AUCTIONS_START_TIME && this.#validateAuctionId(auc.uuid),
				)) {
					if (auction.highest_bid_amount >= TAX_AMOUNT) {
						if (auction.bids.length) taxAuctions.push(auction); // player bid on the auction
					} else if (auction.end > Date.now()) { // auction not expired
						++availableAuctions;
					}
				}

				availableAuctionsLog.push({
					ign: taxCollector.ign,
					auctions: availableAuctions,
				});

				if (taxAuctions.length) dbPromises.push((async () => {
					const paidLog = [];

					// update database
					await Promise.all(taxAuctions.map(async (auction) => {
						const { bidder, amount } = auction.bids.at(-1);
						const player = players.cache.get(bidder);

						if (!player) return;

						try {
							await player.setToPaid({
								amount,
								collectedBy: taxCollector.minecraftUuid,
								auctionId: auction.uuid,
								shouldAdd: true,
							});

							paidLog.push(`${player}: ${this.client.formatNumber(amount)}`);
						} catch (error) {
							logger.error(error);
							paidLog.push(`${player}: ${error}`);
						}
					}));

					// logging
					if (paidLog.length) return {
						name: `/ah ${taxCollector}`,
						value: Formatters.codeBlock(paidLog.join('\n')),
					};
				})());
			} catch (error) {
				logger.error(`[UPDATE TAX DB]: ${taxCollector}`, error);
				apiError = true;
				availableAuctionsLog.push({
					ign: taxCollector.ign,
					auctions: 'API Error',
				});
			}
		}

		// update database
		if (dbPromises.length) {
			setTimeout((() => async () => {
				const taxPaidLog = (await Promise.all(dbPromises)).filter(x => x != null);

				// logging
				if (taxPaidLog.length) {
					this.client.log(this.client.defaultEmbed
						.setTitle('Guild Tax')
						.addFields(...taxPaidLog),
					);
				}
			})(), 0);
		}

		return availableAuctionsLog
			.sort((a, b) => compareAlphabetically(a.ign, b.ign)) // alphabetically
			.sort((a, b) => b.auctions - a.auctions) // number of auctions
			.map(({ ign, auctions }) => `\u200b > ${ign}: ${auctions}`);
	}

	/**
	 * tax embed description
	 * @param {?string[]} availableAuctionsLog
	 */
	#createTaxEmbedDescription(availableAuctionsLog = null) {
		const { config, players, taxCollectors } = this.modelManagers;
		const activeTaxCollectors = taxCollectors.activeCollectors; // eslint-disable-line no-shadow
		const playersInGuild = players.inGuild;
		const PLAYER_COUNT = playersInGuild.size;
		const PAID_COUNT = playersInGuild.filter(({ paid }) => paid).size;
		const TOTAL_COINS = this.client.formatNumber(taxCollectors.cache.reduce((acc, { collectedTax }) => acc + collectedTax, 0));

		return Formatters.codeBlock('cs', stripIndents(commaLists`
			Collectors: # /ah ${activeTaxCollectors.map(player => player.ign).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))}
			Amount: ${this.client.formatNumber(config.get('TAX_AMOUNT'))}
			Items: ${config.get('TAX_AUCTIONS_ITEMS').map(item => `'${item}'`)}
			Paid: ${PAID_COUNT} / ${PLAYER_COUNT} | ${Math.round((PAID_COUNT / PLAYER_COUNT) * 100)} % | collected amount: ${TOTAL_COINS} coins
			Available auctions:
			${availableAuctionsLog?.join('\n') ?? '\u200b -'}
		`));
	}

	/**
	 * tax embed fields
	 */
	#createTaxEmbedFields() {
		const { config, hypixelGuilds } = this.modelManagers;
		const fields = [];

		for (const hypixelGuild of hypixelGuilds.cache.values()) {
			const GUILD_PLAYER_COUNT = hypixelGuild.playerCount;
			const ENTRIES_PER_ROW = Math.ceil(GUILD_PLAYER_COUNT / 3);
			const values = [ '', '', '' ];

			// construct player list in three rows: paid emoji + non line-breaking space + player ign, slice to keep everything in one line
			if (config.get('TAX_TRACKING_ENABLED')) {
				let index = -1;

				for (const player of hypixelGuild.players.values()) {
					values[Math.floor(++index / ENTRIES_PER_ROW)] += `\n${player.paid ? Y_EMOJI_ALT : X_EMOJI}\xa0${player.ign.slice(0, 15)}`;
				}
			} else {
				let index = -1;

				for (const player of hypixelGuild.players.values()) {
					values[Math.floor(++index / ENTRIES_PER_ROW)] += `\n•\xa0${player.ign.slice(0, 15)}`;
				}
			}

			// add rows to tax embed
			for (const [ index, value ] of values.entries()) {
				let paddedValue = value;

				// fill up with empty lines if rows have different size
				for (let emptyLine = ENTRIES_PER_ROW - (paddedValue.match(/\n/g)?.length ?? 0) + 1; --emptyLine;) {
					paddedValue += '\n\u200b';
				}

				fields.push({
					name: index % 2
						? `${hypixelGuild.name} (${GUILD_PLAYER_COUNT})`
						: '\u200b',
					value: Formatters.codeBlock(paddedValue),
					inline: true,
				});
			}
		}

		return fields;
	}

	/**
	 * creates and returns a tax embed
	 * @param {string} [description]
	 * @param {import('discord.js').EmbedField[]} [fields]
	 */
	createTaxEmbed(description = this.#createTaxEmbedDescription(), fields = this.#createTaxEmbedFields()) {
		return this.client.defaultEmbed
			.setTitle('Guild Tax')
			.setDescription(description)
			.addFields(...fields)
			.setFooter('Last updated at');
	}

	/**
	 * updates the player database and the corresponding tax message
	 * @param {import('../../LunarClient').LunarClient} client
	 */
	async updateData() {
		const { config, players, hypixelGuilds } = this.modelManagers;

		// the hypxiel api encountered an error before
		if (config.get('HYPIXEL_API_ERROR')) {
			// reset error every full hour
			if (new Date().getMinutes() >= config.get('DATABASE_UPDATE_INTERVAL')) {
				players.updateIgn();
				return logger.warn('[DB UPDATE]: auto updates disabled');
			}

			config.set('HYPIXEL_API_ERROR', false);
		}

		// update player db
		await hypixelGuilds.updateData({ syncRanks: true });

		// update tax db
		const availableAuctionsLog = config.get('TAX_TRACKING_ENABLED')
			? await this.#updateTaxDatabase()
			: null;

		// update Xp
		if (config.get('XP_TRACKING_ENABLED')) players.updateXp();

		// update IGNs
		await players.updateIgn();

		// update taxMessage
		/** @type {import('discord.js').TextChannel} */
		const taxChannel = this.client.channels.cache.get(config.get('TAX_CHANNEL_ID'));

		if (!taxChannel?.guild?.available) return logger.warn('[TAX MESSAGE]: channel not found');
		if (!ChannelUtil.botPermissions(taxChannel).has(Permissions.FLAGS.VIEW_CHANNEL | Permissions.FLAGS.SEND_MESSAGES | Permissions.FLAGS.EMBED_LINKS)) {
			return logger.warn('[TAX MESSAGE]: missing permission to edit taxMessage');
		}

		const TAX_MESSAGE_ID = config.get('TAX_MESSAGE_ID');
		const taxMessage = TAX_MESSAGE_ID && await taxChannel.messages.fetch(TAX_MESSAGE_ID).catch(error => logger.error('[TAX MESSAGE]', error));

		if (!taxMessage?.editable || taxMessage.deleted) { // taxMessage deleted -> send a new one
			try {
				const { id } = await taxChannel.send({ embeds: [ this.createTaxEmbed(this.#createTaxEmbedDescription(availableAuctionsLog)) ] });

				config.set('TAX_MESSAGE_ID', id);
				return logger.info('[TAX MESSAGE]: created new taxMessage');
			} catch (error) {
				return logger.error('[TAX MESSAGE]', error);
			}
		}

		const description = this.#createTaxEmbedDescription(availableAuctionsLog);
		const fields = this.#createTaxEmbedFields();

		if (taxMessage.embeds[0]?.description === description
			&& taxMessage.embeds[0].fields
				.every(({ name, value }, index) => fields[index].name === name && fields[index].value === value)
		) return; // no changes to taxMessage

		try {
			await taxMessage.edit({ embeds: [ this.createTaxEmbed(description, fields) ] });

			logger.info('[TAX MESSAGE]: updated taxMessage');
		} catch (error) {
			logger.error('[TAX MESSAGE]', error);
		}
	}
}
