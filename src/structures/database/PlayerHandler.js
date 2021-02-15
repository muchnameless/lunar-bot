'use strict';

const { autocorrect } = require('../../functions/util');
const ModelHandler = require('./ModelHandler');
const logger = require('../../functions/logger');


class PlayerHandler extends ModelHandler {
	constructor(options) {
		super(options);

		/**
		 * @type {import('discord.js').Collection<string, import('./models/Player')>}
		 */
		this.cache;
		/**
		 * @type {import('./models/Player')}
		 */
		this.model;
	}

	/**
	 * @returns {string[]}
	 */
	get ignoredAuctions() {
		return this.cache.array().flatMap(player => player.auctionID ?? []);
	}

	async loadCache() {
		await super.loadCache({
			where: {
				// player is in a guild that the bot tracks (guildID !== null)
				guildID: {
					[this.client.db.Sequelize.Op.ne]: null,
				},
			},
		});

		this.sortAlphabetically();
	}

	set(key, value) {
		this.client.hypixelGuilds.cache.get(value.guildID).players = null;
		return this.cache.set(key, value);
	}

	delete(key) {
		const hypixelGuild = this.client.hypixelGuilds.cache.get(this.cache.get(key)?.guildID);
		if (hypixelGuild) hypixelGuild.players = null;

		return this.cache.delete(key);
	}

	sweep(fn) {
		this.client.hypixelGuilds.cache.forEach(hGuild => hGuild.players = null);
		return this.cache.sweep(fn);
	}

	clear() {
		this.client.hypixelGuilds.cache.forEach(hGuild => hGuild.players = null);
		return this.cache.clear();
	}

	sort(compareFunction) {
		this.client.hypixelGuilds.cache.forEach(hGuild => hGuild.players = null);
		return this.cache.sort(compareFunction);
	}

	/**
	 * add a player to the db and db cache
	 * @param {object} options options for the new db entry
	 * @param {boolean} isAddingSingleEntry wether to call sortAlphabetically() and updateXp() after adding the new entry
	 */
	async add(options = {}, isAddingSingleEntry = true) {
		const newPlayer = await super.add(options);

		if (isAddingSingleEntry) {
			this.sortAlphabetically();

			newPlayer.update({
				shouldSkipQueue: true,
				reason: `joined ${newPlayer.guild?.name}`,
			});
		}

		return newPlayer;
	}

	/**
	 * deletes all unnecessary db entries
	 */
	async sweepDb() {
		const playersToSweep = await this.model.findAll({
			where: {
				guildID: null,
				paid: false,
			},
		});
		const sweepedIgns = playersToSweep.map(player => player.ign).join(', ');
		const AMOUNT = playersToSweep.length;

		playersToSweep.forEach(player => player.destroy());
		logger.warn(`[SWEEP DB]: removed ${AMOUNT} entr${AMOUNT === 1 ? 'y' : 'ies'} from the player db: ${sweepedIgns}`);

		return AMOUNT;
	}

	/**
	 * sweeps all cached discord members
	 */
	sweepDiscordMemberCache() {
		return this.cache.each(player => player.discordMember = null);
	}

	/**
	 * get a player by their IGN, case insensitive and with auto-correction
	 * @param {string} ign ign of the player
	 * @returns {?import('./models/Player')}
	 */
	getByIGN(ign) {
		if (!ign) return null;

		const result = autocorrect(ign, this.cache, 'ign');

		return (result.similarity >= this.client.config.get('AUTOCORRECT_THRESHOLD'))
			? result.value
			: null;
	}

	/**
	 * get a player by their discord ID
	 * @param {string} id discord id of the player
	 * @returns {?import('./models/Player')}
	 */
	getByID(id) {
		if (!id) return null;
		return this.cache.find(player => player.discordID === id) ?? null;
	}

	/**
	 * sort alphabetically by IGNs
	 */
	sortAlphabetically() {
		this.cache._array = null;
		return this.cache.sort((a, b) => a.ign.toLowerCase().localeCompare(b.ign.toLowerCase()));
	}

	/**
	 * update db entries and linked discord members of all players
	 */
	update(options = {}) {
		return this.cache.each(player => player.update(options).catch(error => logger.error(`[UPDATE XP]: ${error.name}: ${error.message}`)));
	}

	/**
	 * reset xp of all players
	 * @param {object} options reset options
	 */
	resetXp(options = {}) {
		return this.cache.each(player => player.resetXp(options).catch(error => logger.error(`[RESET XP]: ${error.name}: ${error.message}`)));
	}
}

module.exports = PlayerHandler;
