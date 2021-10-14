import { Permissions, Formatters, VoiceChannel } from 'discord.js';
import { CronJob as CronJobConstructor } from 'cron';
import { stripIndents, commaLists } from 'common-tags';
import pkg from 'sequelize';
const { Model } = pkg;
import { DEFAULT_CONFIG, X_EMOJI, Y_EMOJI_ALT } from '../../../constants';
import { hypixel } from '../../../api/hypixel';
import { ConfigManager } from './ConfigManager';
import { HypixelGuildManager } from './HypixelGuildManager';
import { PlayerManager } from './PlayerManager';
import { TaxCollectorManager } from './TaxCollectorManager';
import { ModelManager } from './ModelManager';
import { ChannelUtil } from '../../../util';
import { asyncFilter, compareAlphabetically, logger } from '../../../functions';
import type { EmbedFieldData, GuildChannel } from 'discord.js';
import type { ModelCtor, Sequelize } from 'sequelize';
import type { Components } from '@zikeji/hypixel';
import type { ChatTrigger } from '../models/ChatTrigger';
import type { Config } from '../models/Config';
import type { HypixelGuild } from '../models/HypixelGuild';
import type { Player } from '../models/Player';
import type { TaxCollector } from '../models/TaxCollector';
import type { db as DbType } from '..';
import type { Transaction } from '../models/Transaction';
import type { LunarClient } from '../../LunarClient';


export interface Models {
	ChatTrigger: ModelCtor<ChatTrigger>,
	Config: ModelCtor<Config>,
	HypixelGuild: ModelCtor<HypixelGuild>,
	Player: ModelCtor<Player>,
	TaxCollector: ModelCtor<TaxCollector>,
	Transaction: ModelCtor<Transaction>,
}


export class DatabaseManager {
	client: LunarClient;
	/**
	 * ModelManagers
	 */
	modelManagers: {
		chatTriggers: ModelManager<ChatTrigger>;
		config: ConfigManager;
		hypixelGuilds: HypixelGuildManager;
		players: PlayerManager;
		taxCollectors: TaxCollectorManager;
	};
	/**
	 * Models
	 */
	models: Models;
	/**
	 * Sequelize instance
	 */
	sequelize: Sequelize;
	/**
	 * db data update
	 */
	#updateDataPromise: Promise<this> | null = null;

	constructor(client: LunarClient, db: typeof DbType) {
		this.client = client;
		this.modelManagers = {
			chatTriggers: new ModelManager(client, db.ChatTrigger),
			config: new ConfigManager(client, db.Config),
			hypixelGuilds: new HypixelGuildManager(client, db.HypixelGuild),
			players: new PlayerManager(client, db.Player),
			taxCollectors: new TaxCollectorManager(client, db.TaxCollector),
		};
		this.models = Object.fromEntries(
			Object.entries(db)
				.filter(([ , value ]) => Object.getPrototypeOf(value) === Model && Reflect.defineProperty(
					// @ts-expect-error
					value.prototype,
					'client',
					{ value: client },
				)),
		) as unknown as Models;
		this.sequelize = db.sequelize;
	}

	/**
	 * update player database and tax message every x min starting at the full hour
	 */
	schedule() {
		const { config } = this.modelManagers;

		this.client.cronJobs.schedule('updatePlayerDatabase', new CronJobConstructor({
			cronTime: `0 0/${config.get('DATABASE_UPDATE_INTERVAL')} * * * *`,
			onTick: () => config.get('PLAYER_DB_UPDATE_ENABLED') && this.updateData(),
			start: true,
		}));

		// schedule guild stats channel update
		this.client.cronJobs.schedule('guildStatsChannelUpdate', new CronJobConstructor({
			cronTime: '0 0 * * * *',
			onTick: async () => {
				if (!config.get('AVERAGE_STATS_CHANNEL_UPDATE_ENABLED')) return;

				const { mainGuild } = this.modelManagers.hypixelGuilds;

				if (!mainGuild) return;

				const { formattedStats } = mainGuild;

				try {
					for (const type of [ 'weight', 'skill', 'slayer', 'catacombs' ] as const) {
						const channel = this.client.channels.cache.get(config.get(`${type}_AVERAGE_STATS_CHANNEL_ID`));

						if (!(channel instanceof VoiceChannel)) { // no channel found
							logger.warn(`[GUILD STATS CHANNEL UPDATE]: ${type}: no channel found`);
							continue;
						}

						const newName = `${type}︱${formattedStats[`${type}Average`]}`;
						const { name: oldName } = channel;

						if (newName === oldName) continue; // no update needed

						if (!channel.manageable) {
							logger.error(`[GUILD STATS CHANNEL UPDATE]: ${channel.name}: missing permissions to edit`);
							continue;
						}

						await channel.setName(newName, `synced with ${mainGuild.name}'s average stats`);

						logger.info(`[GUILD STATS CHANNEL UPDATE]: '${oldName}' -> '${newName}'`);
					}
				} catch (error) {
					logger.error(error, '[GUILD STATS CHANNEL UPDATE]');
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
		await Promise.all(Object.entries(DEFAULT_CONFIG).map(
			([ key, value ]) => (
				this.modelManagers.config.get(key as keyof typeof DEFAULT_CONFIG) !== null
					? null
					: this.modelManagers.config.set(key, value)
			),
		));

		return this;
	}

	/**
	 * loads all db caches (performs a sweep first)
	 */
	async loadCache() {
		await Promise.all(
			Object.values(this.modelManagers).map(manager => manager.loadCache()),
		);

		return this;
	}

	/**
	 * sweeps all db caches
	 */
	sweepCache() {
		for (const handler of Object.values(this.modelManagers)) {
			handler.sweepCache();
		}

		return this;
	}

	/**
	 * false if the auctionId is already in the transactions db, true if not
	 * @param auctionId
	 */
	async #validateAuctionId(auctionId: string) {
		return (await this.models.Transaction.findOne({
			where: { auctionId },
			attributes: [ 'id' ],
			raw: true, // to not parse an eventual result
		})) === null;
	}

	/**
	 * updates the tax database, returns availableAuctions per taxCollector
	 */
	async #updateTaxDatabase() {
		const { config, players, taxCollectors } = this.modelManagers;
		const TAX_AUCTIONS_START_TIME = config.get('TAX_AUCTIONS_START_TIME');
		const TAX_AMOUNT = config.get('TAX_AMOUNT');
		const TAX_AUCTIONS_ITEMS = config.get('TAX_AUCTIONS_ITEMS');
		const availableAuctionsLog: { ign: string | null, auctions: string | number }[] = [];
		const dbPromises: Promise<EmbedFieldData | undefined>[] = [];

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

				const taxAuctions: Components.Schemas.SkyBlockAuction[] = [];

				let availableAuctions = 0;

				// filter auctions
				for (const auction of await asyncFilter(
					auctions,
					// correct item & started after last reset & no outbid from already logged auction
					auc => TAX_AUCTIONS_ITEMS.includes(auc.item_name) && auc.start >= TAX_AUCTIONS_START_TIME && this.#validateAuctionId(auc.uuid),
				) as Components.Schemas.SkyBlockAuction[]) {
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
					const paidLog: string[] = [];

					// update database
					await Promise.all(taxAuctions.map(async (auction) => {
						const { bidder, amount } = auction.bids.at(-1)!;
						const player = players.cache.get(bidder);

						if (!player) return;

						try {
							await player.setToPaid({
								amount,
								collectedBy: taxCollector.minecraftUuid,
								auctionId: auction.uuid,
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
				logger.error(error, `[UPDATE TAX DB]: ${taxCollector}`);
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
				const taxPaidLog = (await Promise.all(dbPromises)).filter(x => x != null) as EmbedFieldData[];

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
			.sort((a, b) => Number(b.auctions) - Number(a.auctions)) // number of auctions
			.map(({ ign, auctions }) => `\u200B > ${ign}: ${auctions}`);
	}

	/**
	 * tax embed description
	 * @param availableAuctionsLog
	 */
	#createTaxEmbedDescription(availableAuctionsLog: string[] | null = null) {
		const { config, players, taxCollectors } = this.modelManagers;
		const playersInGuild = players.inGuild;
		const PLAYER_COUNT = playersInGuild.size;
		const PAID_COUNT = playersInGuild.filter(({ paid }) => paid).size;
		const TOTAL_COINS = this.client.formatNumber(taxCollectors.cache.reduce((acc, { collectedTax }) => acc + collectedTax, 0));

		return Formatters.codeBlock('cs', stripIndents(commaLists`
			Collectors: # /ah ${taxCollectors.activeCollectors.map(collector => collector.ign).sort(compareAlphabetically)}
			Amount: ${this.client.formatNumber(config.get('TAX_AMOUNT'))}
			Items: ${config.get('TAX_AUCTIONS_ITEMS').map(item => `'${item}'`)}
			Paid: ${PAID_COUNT} / ${PLAYER_COUNT} | ${Math.round((PAID_COUNT / PLAYER_COUNT) * 100)} % | collected amount: ${TOTAL_COINS} coins
			Available auctions:
			${availableAuctionsLog?.join('\n') ?? '\u200B -'}
		`));
	}

	/**
	 * tax embed fields
	 */
	#createTaxEmbedFields() {
		const { config, hypixelGuilds } = this.modelManagers;
		const fields: EmbedFieldData[] = [];

		for (const hypixelGuild of hypixelGuilds.cache.values()) {
			const GUILD_PLAYER_COUNT = hypixelGuild.playerCount;
			const ENTRIES_PER_ROW = Math.ceil(GUILD_PLAYER_COUNT / 3);
			const values = [ '', '', '' ];

			// construct player list in three rows: paid emoji + non line-breaking space + player ign, slice to keep everything in one line
			if (config.get('TAX_TRACKING_ENABLED')) {
				let index = -1;

				for (const player of hypixelGuild.players.values()) {
					values[Math.floor(++index / ENTRIES_PER_ROW)] += `\n${player.paid ? Y_EMOJI_ALT : X_EMOJI}\u00A0${player.ign.slice(0, 15)}`;
				}
			} else {
				let index = -1;

				for (const player of hypixelGuild.players.values()) {
					values[Math.floor(++index / ENTRIES_PER_ROW)] += `\n•\u00A0${player.ign.slice(0, 15)}`;
				}
			}

			// add rows to tax embed
			for (const [ index, value ] of values.entries()) {
				let paddedValue = value;

				// fill up with empty lines if rows have different size
				for (let emptyLine = ENTRIES_PER_ROW - (paddedValue.match(/\n/g)?.length ?? 0) + 1; --emptyLine;) {
					paddedValue += '\n\u200B';
				}

				fields.push({
					name: index % 2
						? `${hypixelGuild} (${GUILD_PLAYER_COUNT})`
						: '\u200B',
					value: Formatters.codeBlock(paddedValue),
					inline: true,
				});
			}
		}

		return fields;
	}

	/**
	 * creates and returns a tax embed
	 * @param description
	 * @param fields
	 */
	createTaxEmbed(description: string = this.#createTaxEmbedDescription(), fields: EmbedFieldData[] = this.#createTaxEmbedFields()) {
		return this.client.defaultEmbed
			.setTitle('Guild Tax')
			.setDescription(description)
			.addFields(...fields)
			.setFooter('Last updated at');
	}

	/**
	 * updates the player database and the corresponding tax message
	 */
	async updateData() {
		if (this.#updateDataPromise) return this.#updateDataPromise;

		try {
			return await (this.#updateDataPromise = this.#updateData());
		} finally {
			this.#updateDataPromise = null;
		}
	}
	/**
	 * should only ever be called from within updateData()
	 * @internal
	 */
	async #updateData() {
		try {
			const { config, players, hypixelGuilds } = this.modelManagers;

			// the hypxiel api encountered an error before
			if (config.get('HYPIXEL_API_ERROR')) {
				// reset error every full hour
				if (new Date().getMinutes() >= config.get('DATABASE_UPDATE_INTERVAL')) {
					await players.updateIgns();

					for (const hypixelGuild of hypixelGuilds.cache.values()) {
						hypixelGuild.syncRanks();
					}

					logger.warn('[DB UPDATE]: auto updates disabled');
					return this;
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
			await players.updateIgns();

			// update taxMessage
			const taxChannel = this.client.channels.cache.get(config.get('TAX_CHANNEL_ID'));

			if (!taxChannel?.isText() || ((taxChannel as GuildChannel).guildId && !(taxChannel as GuildChannel).guild?.available)) {
				logger.warn('[TAX MESSAGE] tax channel error');
				return this;
			}
			if (!ChannelUtil.botPermissions(taxChannel)?.has([ Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES, Permissions.FLAGS.EMBED_LINKS ])) {
				logger.warn('[TAX MESSAGE]: missing permission to edit taxMessage');
				return this;
			}

			const TAX_MESSAGE_ID = config.get('TAX_MESSAGE_ID');
			const taxMessage = TAX_MESSAGE_ID
				? await taxChannel.messages.fetch(TAX_MESSAGE_ID).catch(error => logger.error(error, '[TAX MESSAGE]'))
				: null;

			if (!taxMessage?.editable || taxMessage.deleted) { // taxMessage deleted -> send a new one
				const { id } = await taxChannel.send({ embeds: [ this.createTaxEmbed(this.#createTaxEmbedDescription(availableAuctionsLog)) ] });

				config.set('TAX_MESSAGE_ID', id);
				logger.info('[TAX MESSAGE]: created new taxMessage');
				return this;
			}

			const DESCRIPTION = this.#createTaxEmbedDescription(availableAuctionsLog);
			const fields = this.#createTaxEmbedFields();

			if (taxMessage.embeds[0]?.description === DESCRIPTION
				&& taxMessage.embeds[0].fields
					.every(({ name, value }, index) => fields[index].name === name && fields[index].value === value)
			) return this; // no changes to taxMessage

			await taxMessage.edit({ embeds: [ this.createTaxEmbed(DESCRIPTION, fields) ] });
			logger.info('[TAX MESSAGE]: updated taxMessage');
			return this;
		} catch (error) {
			logger.error(error, '[DATABASE UPDATE ERROR]');
			return this;
		}
	}
}
