import { setTimeout } from 'node:timers';
import { objectEntries } from '@sapphire/utilities';
import { type Components } from '@zikeji/hypixel';
import { stripIndents } from 'common-tags';
import { CronJob as CronJobConstructor } from 'cron';
import {
	codeBlock,
	DiscordAPIError,
	PermissionFlagsBits,
	RESTJSONErrorCodes,
	type APIEmbedField,
	type GuildChannel,
	type Message,
} from 'discord.js';
import { Model, type Sequelize, type ModelStatic } from 'sequelize';
import { type db as DbType } from '../index.js';
import { type ChatTrigger } from '../models/ChatTrigger.js';
import { type Config } from '../models/Config.js';
import { type DiscordGuild } from '../models/DiscordGuild.js';
import { type HypixelGuild } from '../models/HypixelGuild.js';
import { type HypixelGuildBan } from '../models/HypixelGuildBan.js';
import { type Player } from '../models/Player.js';
import { type SkyBlockPatchNote } from '../models/SkyBlockPatchNote.js';
import { type TaxCollector } from '../models/TaxCollector.js';
import { type Transaction } from '../models/Transaction.js';
import { ConfigManager } from './ConfigManager.js';
import { HypixelGuildManager } from './HypixelGuildManager.js';
import { ModelManager } from './ModelManager.js';
import { PlayerManager } from './PlayerManager.js';
import { TaxCollectorManager } from './TaxCollectorManager.js';
import { hypixel } from '#api';
import { AnsiColour, AnsiFormat, DEFAULT_CONFIG, HYPIXEL_UPDATE_INTERVAL, UnicodeEmoji } from '#constants';
import { ansi, asyncFilter, commaListOr, compareAlphabetically, formatNumber, isFirstMinutesOfHour } from '#functions';
import { logger } from '#logger';
import { type LunarClient } from '#structures/LunarClient.js';
import { ChannelUtil } from '#utils';

export interface Models {
	ChatTrigger: ModelStatic<ChatTrigger>;
	Config: ModelStatic<Config>;
	DiscordGuild: ModelStatic<DiscordGuild>;
	HypixelGuild: ModelStatic<HypixelGuild>;
	HypixelGuildBan: ModelStatic<HypixelGuildBan>;
	Player: ModelStatic<Player>;
	SkyBlockPatchNote: ModelStatic<SkyBlockPatchNote>;
	TaxCollector: ModelStatic<TaxCollector>;
	Transaction: ModelStatic<Transaction>;
}

export class DatabaseManager {
	public declare readonly client: LunarClient;

	/**
	 * ModelManagers
	 */
	public readonly modelManagers: {
		chatTriggers: ModelManager<ChatTrigger>;
		config: ConfigManager;
		discordGuilds: ModelManager<DiscordGuild>;
		hypixelGuilds: HypixelGuildManager;
		players: PlayerManager;
		taxCollectors: TaxCollectorManager;
	};

	/**
	 * Models
	 */
	public readonly models: Models;

	/**
	 * Sequelize instance
	 */
	public readonly sequelize: Sequelize;

	/**
	 * db data update
	 */
	private _updateDataPromise: Promise<this> | null = null;

	public constructor(client: LunarClient, db: typeof DbType) {
		Object.defineProperty(this, 'client', { value: client });

		this.modelManagers = {
			chatTriggers: new ModelManager(client, db.ChatTrigger),
			config: new ConfigManager(client, db.Config),
			discordGuilds: new ModelManager(client, db.DiscordGuild),
			hypixelGuilds: new HypixelGuildManager(client, db.HypixelGuild),
			players: new PlayerManager(client, db.Player),
			taxCollectors: new TaxCollectorManager(client, db.TaxCollector),
		};
		this.models = Object.fromEntries(
			Object.entries(db).filter(
				([, value]) =>
					Object.getPrototypeOf(value) === Model &&
					Reflect.defineProperty(
						// @ts-expect-error value 'prototype' does not exist on type ...
						value.prototype,
						'client',
						{ value: client },
					),
			),
		) as unknown as Models;
		this.sequelize = db.sequelize;
	}

	/**
	 * update player database and tax message every x min starting at the full hour
	 */
	public schedule() {
		const { config } = this.modelManagers;

		this.client.cronJobs.schedule(
			`${this.constructor.name}:updatePlayerDatabase`,
			new CronJobConstructor({
				cronTime: `0 0/${HYPIXEL_UPDATE_INTERVAL} * * * *`,
				onTick: () => config.get('PLAYER_DB_UPDATE_ENABLED') && this.updateData(),
			}),
		);

		for (const manager of Object.values(this.modelManagers)) {
			manager.schedule();
		}
	}

	/**
	 * initialises the database and cache
	 */
	public async init() {
		await this.loadCache(); // load caches

		// set default config
		await Promise.all(
			objectEntries(DEFAULT_CONFIG).map(
				([key, value]) => this.modelManagers.config.get(key) === null && this.modelManagers.config.set(key, value),
			),
		);

		return this;
	}

	/**
	 * loads all db caches (performs a sweep first)
	 */
	public async loadCache() {
		await Promise.all(Object.values(this.modelManagers).map(async (manager) => manager.loadCache()));

		return this;
	}

	/**
	 * sweeps all db caches
	 */
	public sweepCache() {
		for (const handler of Object.values(this.modelManagers)) {
			handler.sweepCache();
		}

		return this;
	}

	/**
	 * false if the auctionId is already in the transactions db, true if not
	 *
	 * @param auctionId
	 */
	private async _validateAuctionId(auctionId: string) {
		return (
			(await this.models.Transaction.findOne({
				where: { auctionId },
				attributes: ['id'],
				raw: true, // to not parse an eventual result
			})) === null
		);
	}

	/**
	 * updates the tax database, returns availableAuctions per taxCollector
	 */
	private async _updateTaxDatabase() {
		const { config, players, taxCollectors } = this.modelManagers;
		const TAX_AUCTIONS_START_TIME = config.get('TAX_AUCTIONS_START_TIME');
		const TAX_AMOUNT = config.get('TAX_AMOUNT');
		const TAX_AUCTIONS_ITEMS = config.get('TAX_AUCTIONS_ITEMS');
		const availableAuctionsLog: { auctions: number | string; ign: string | null }[] = [];
		const dbPromises: Promise<APIEmbedField | undefined>[] = [];

		let apiError = false;

		// update db
		for (const taxCollector of taxCollectors.cache.values()) {
			if (!taxCollector.isCollecting) continue; // skip retired collectors

			if (apiError) {
				// skip the rest if an API error occurred
				availableAuctionsLog.push({
					ign: taxCollector.ign,
					auctions: 'API Error',
				});

				continue;
			}

			try {
				const { auctions } = await hypixel.skyblock.auction.player(taxCollector.minecraftUuid);

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
					(a) =>
						TAX_AUCTIONS_ITEMS.includes(a.item_name) &&
						a.start >= TAX_AUCTIONS_START_TIME &&
						this._validateAuctionId(a.uuid),
				)) {
					if (auction.highest_bid_amount >= TAX_AMOUNT) {
						if (auction.bids.length) taxAuctions.push(auction); // player bid on the auction
					} else if (auction.end > Date.now()) {
						// auction not expired
						++availableAuctions;
					}
				}

				availableAuctionsLog.push({
					ign: taxCollector.ign,
					auctions: availableAuctions,
				});

				if (taxAuctions.length) {
					dbPromises.push(
						(async () => {
							const paidLog: string[] = [];

							// update database
							await Promise.all(
								taxAuctions.map(async (auction) => {
									const { bidder, amount } = auction.bids.at(-1)!;
									const player = players.cache.get(bidder);

									if (!player) return;

									try {
										await player.setToPaid({
											amount,
											collectedBy: taxCollector.minecraftUuid,
											auctionId: auction.uuid,
										});

										paidLog.push(`${player}: ${formatNumber(amount)}`);
									} catch (error) {
										logger.error({ err: error, player: player.logInfo, taxCollector: taxCollector.logInfo });
										paidLog.push(`${player}: ${error}`);
									}
								}),
							);

							// logging
							if (paidLog.length) {
								return {
									name: `/ah ${taxCollector}`,
									value: codeBlock(paidLog.join('\n')),
								};
							}
						})(),
					);
				}
			} catch (error) {
				logger.error({ err: error, taxCollector: taxCollector.logInfo }, '[UPDATE TAX DB]');
				apiError = true;
				availableAuctionsLog.push({
					ign: taxCollector.ign,
					auctions: 'API Error',
				});
			}
		}

		// update database
		if (dbPromises.length) {
			setTimeout(async () => {
				const taxPaidLog = (await Promise.all(dbPromises)).filter((x): x is APIEmbedField => typeof x !== 'undefined');

				// logging
				if (taxPaidLog.length) {
					void this.client.log(
						this.client.defaultEmbed //
							.setTitle('Guild Tax')
							.addFields(taxPaidLog),
					);
				}
			}, 0);
		}

		return availableAuctionsLog
			.sort(({ ign: a }, { ign: b }) => compareAlphabetically(a, b)) // alphabetically
			.sort(({ auctions: a }, { auctions: b }) => Number(b) - Number(a)) // number of auctions
			.map(({ ign, auctions }) => `\u200B > ${ansi(ign!, AnsiColour.Red)}: ${ansi(auctions, AnsiColour.Cyan)}`);
	}

	/**
	 * tax embed description
	 *
	 * @param availableAuctionsLog
	 */
	private _createTaxEmbedDescription(availableAuctionsLog: string[] | null = null) {
		const { config, players, taxCollectors } = this.modelManagers;
		const playersInGuild = players.inGuild;
		const PLAYER_COUNT = playersInGuild.size;
		const PAID_COUNT = playersInGuild.filter(({ paid }) => paid).size;
		const TOTAL_COINS = formatNumber(taxCollectors.cache.reduce((acc, { collectedTax }) => acc + collectedTax, 0));

		return codeBlock(
			'ansi',
			stripIndents`
				Collectors: ${ansi('/ah', AnsiFormat.Bold, AnsiColour.Red)} ${commaListOr(
				taxCollectors.activeCollectors
					.map(({ ign }) => ansi(ign!, AnsiFormat.Bold, AnsiColour.Red))
					.sort(compareAlphabetically),
			)}
				Amount: ${ansi(formatNumber(config.get('TAX_AMOUNT')), AnsiFormat.Bold, AnsiColour.Cyan)}
				Items: ${config.get('TAX_AUCTIONS_ITEMS').map((item) => `'${ansi(item, AnsiFormat.Bold, AnsiColour.Blue)}'`)}
				Paid: ${ansi(PAID_COUNT, AnsiColour.Cyan)} / ${ansi(PLAYER_COUNT, AnsiColour.Cyan)} | ${ansi(
				Math.round((PAID_COUNT / PLAYER_COUNT) * 100),
				AnsiColour.Cyan,
			)} % | collected amount: ${ansi(TOTAL_COINS, AnsiColour.Cyan)} $
				Available auctions:
				${availableAuctionsLog?.join('\n') ?? '\u200B -'}
			`,
		);
	}

	/**
	 * tax embed fields
	 */
	private _createTaxEmbedFields() {
		const { config, hypixelGuilds } = this.modelManagers;
		const fields: APIEmbedField[] = [];

		for (const hypixelGuild of hypixelGuilds.cache.values()) {
			const GUILD_PLAYER_COUNT = hypixelGuild.playerCount;
			const ENTRIES_PER_ROW = Math.ceil(GUILD_PLAYER_COUNT / 3);
			const values = ['', '', ''];

			// construct player list in three rows: paid emoji + non line-breaking space + player ign, slice to keep everything in one line
			if (config.get('TAX_TRACKING_ENABLED')) {
				let index = -1;

				for (const player of hypixelGuild.players.values()) {
					values[Math.trunc(++index / ENTRIES_PER_ROW)] += `\n${
						player.paid ? UnicodeEmoji.VarY : UnicodeEmoji.X
					}\u00A0${player.ign.slice(0, 15)}`;
				}
			} else {
				let index = -1;

				for (const player of hypixelGuild.players.values()) {
					values[Math.trunc(++index / ENTRIES_PER_ROW)] += `\n•\u00A0${player.ign.slice(0, 15)}`;
				}
			}

			// add rows to tax embed
			for (const [index, value] of values.entries()) {
				let paddedValue = value;

				// fill up with empty lines if rows have different size
				for (let emptyLine = ENTRIES_PER_ROW - (paddedValue.match(/\n/g)?.length ?? 0) + 1; --emptyLine; ) {
					paddedValue += '\n\u200B';
				}

				fields.push({
					name: index % 2 ? `${hypixelGuild} (${GUILD_PLAYER_COUNT})` : '\u200B',
					value: codeBlock(paddedValue),
					inline: true,
				});
			}
		}

		return fields;
	}

	/**
	 * creates and returns a tax embed
	 *
	 * @param description
	 * @param fields
	 */
	public createTaxEmbed(
		description: string = this._createTaxEmbedDescription(),
		fields: APIEmbedField[] = this._createTaxEmbedFields(),
	) {
		return this.client.defaultEmbed
			.setTitle('Guild Tax')
			.setDescription(description)
			.addFields(fields)
			.setFooter({ text: 'Last updated at' });
	}

	/**
	 * updates the player database and the corresponding tax message
	 */
	public async updateData() {
		if (this._updateDataPromise) return this._updateDataPromise;

		try {
			return await (this._updateDataPromise = this.#updateData());
		} finally {
			this._updateDataPromise = null;
		}
	}

	/**
	 * should only ever be called from within updateData
	 *
	 * @internal
	 */
	async #updateData() {
		try {
			const { config, players, hypixelGuilds } = this.modelManagers;

			// the hypixel api encountered an error before
			if (config.get('HYPIXEL_API_ERROR')) {
				// reset error every full hour
				if (isFirstMinutesOfHour(HYPIXEL_UPDATE_INTERVAL)) {
					void config.set('HYPIXEL_API_ERROR', false);
				} else {
					for (const hypixelGuild of hypixelGuilds.cache.values()) {
						void hypixelGuild.syncRanks();
					}

					logger.warn('[DB UPDATE]: auto updates disabled');
					return this;
				}
			}

			// update player db
			await hypixelGuilds.updateData();

			// update tax db
			const availableAuctionsLog = config.get('TAX_TRACKING_ENABLED') ? await this._updateTaxDatabase() : null;

			// update Xp
			if (config.get('XP_TRACKING_ENABLED')) void players.updateXp();

			// update taxMessage
			const taxChannel = this.client.channels.cache.get(config.get('TAX_CHANNEL_ID'));

			if (
				!taxChannel?.isTextBased() ||
				((taxChannel as GuildChannel).guildId && !(taxChannel as GuildChannel).guild?.available)
			) {
				logger.warn({ taxChannel: ChannelUtil.logInfo(taxChannel) }, '[TAX MESSAGE] tax channel error');
				return this;
			}

			if (!ChannelUtil.botPermissions(taxChannel).has(PermissionFlagsBits.ViewChannel, false)) {
				logger.warn(
					{ taxChannel: ChannelUtil.logInfo(taxChannel) },
					'[TAX MESSAGE]: missing permission to edit taxMessage',
				);
				return this;
			}

			const TAX_MESSAGE_ID = config.get('TAX_MESSAGE_ID');

			let taxMessage: Message | null = null;

			if (TAX_MESSAGE_ID) {
				try {
					taxMessage = await taxChannel.messages.fetch(TAX_MESSAGE_ID);
				} catch (error) {
					logger.error(
						{ err: error, taxChannel: ChannelUtil.logInfo(taxChannel), taxMessageId: TAX_MESSAGE_ID },
						'[TAX MESSAGE]: fetch',
					);

					// abort updating if the error is not 'unknown message (-> message was deleted)'
					if (!(error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownMessage)) {
						logger.warn('[TAX MESSAGE]: aborting update');
						return this;
					}
				}
			}

			if (!taxMessage?.editable) {
				// taxMessage deleted -> send a new one
				const { id } = await taxChannel.send({
					embeds: [this.createTaxEmbed(this._createTaxEmbedDescription(availableAuctionsLog))],
				});

				void config.set('TAX_MESSAGE_ID', id);
				logger.info(
					{ taxChannel: ChannelUtil.logInfo(taxChannel), taxMessageId: id },
					'[TAX MESSAGE]: created new taxMessage',
				);
				return this;
			}

			const DESCRIPTION = this._createTaxEmbedDescription(availableAuctionsLog);
			const fields = this._createTaxEmbedFields();

			if (
				taxMessage.embeds[0]?.description === DESCRIPTION &&
				taxMessage.embeds[0].fields?.every(
					({ name, value }, index) => fields[index]?.name === name && fields[index]?.value === value,
				)
			) {
				return this; // no changes to taxMessage
			}

			await taxMessage.edit({ embeds: [this.createTaxEmbed(DESCRIPTION, fields)] });
			logger.info('[TAX MESSAGE]: updated taxMessage');
			return this;
		} catch (error) {
			logger.error(error, '[UPDATE DATA]');
			return this;
		}
	}
}
