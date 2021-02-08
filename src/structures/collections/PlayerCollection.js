'use strict';

const { Player } = require('../../../database/models/index');
const { autocorrect } = require('../../functions/util');
const logger = require('../../functions/logger');
const BaseClientCollection = require('./BaseClientCollection');


class PlayerCollection extends BaseClientCollection {
	constructor(client, entries) {
		super(client, entries);
	}

	set(key, value) {
		// this.client could be undefined cause set gets called in the COPY-CTOR (super) and this.client is set afterwards
		if (this.client) this.client.hypixelGuilds.get(value.guildID)._players = null;
		return super.set(key, value);
	}

	delete(key) {
		this.client?.hypixelGuilds.forEach(hGuild => hGuild._players = null);
		return super.delete(key);
	}

	sweep(fn) {
		this.client?.hypixelGuilds.forEach(hGuild => hGuild._players = null);
		return super.sweep(fn);
	}

	clear() {
		this.client?.hypixelGuilds.forEach(hGuild => hGuild._players = null);
		return super.clear();
	}

	sort(compareFunction) {
		this.client?.hypixelGuilds.forEach(hGuild => hGuild._players = null);
		return super.sort(compareFunction);
	}

	/**
	 * add a player to the db and db cache
	 * @param {object} options options for the new db entry
	 * @param {boolean} isAddingSingleEntry wether to call sortAlphabetically() and updateXp() after adding the new entry
	 */
	async add(options = {}, isAddingSingleEntry = true) {
		const newPlayer = await Player.create(options);

		this.set(newPlayer.minecraftUUID, newPlayer);

		if (isAddingSingleEntry) {
			this.sortAlphabetically();

			newPlayer.updateXp({
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
		const playersToSweep = await Player.findAll({
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
	 * get a player by their IGN, case insensitive and with auto-correction
	 * @param {string} ign ign of the player
	 */
	getByIGN(ign) {
		if (!ign) return null;

		const result = autocorrect(ign, this, 'ign');

		return (result.similarity >= this.client.config.get('AUTOCORRECT_THRESHOLD'))
			? result.value
			: null;
	}

	/**
	 * get a player by their discord ID
	 * @param {string} id discord id of the player
	 */
	getByID(id) {
		if (!id) return null;
		return this.find(player => player.discordID === id) ?? null;
	}

	/**
	 * sort alphabetically by IGNs
	 */
	sortAlphabetically() {
		this._array = null;
		return this.sort((a, b) => a.ign.toLowerCase().localeCompare(b.ign.toLowerCase()));
	}

	/**
	 * update xp of all players
	 */
	updateXp(options = {}) {
		return this.each(player => player.updateXp(options).catch(error => logger.error(`[UPDATE XP]: ${error.name}: ${error.message}`)));
	}

	/**
	 * reset xp of all players
	 * @param {object} options reset options
	 */
	resetXp(options = {}) {
		return this.each(player => player.resetXp(options).catch(error => logger.error(`[RESET XP]: ${error.name}: ${error.message}`)));
	}
}

module.exports = PlayerCollection;
