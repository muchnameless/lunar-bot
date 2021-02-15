'use strict';

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
	constructor({ client, db }) {
		this.client = client;
		this.bannedUsers = new BannedUserHandler({ client, model: BannedUser });
		this.config = new ConfigHandler({ client, model: Config });
		this.cronJobs = new CronJobHandler({ client, model: CronJob });
		this.hypixelGuilds = new HypixelGuildHandler({ client, model: HypixelGuild });
		this.players = new PlayerHandler({ client, model: Player });
		this.taxCollectors = new TaxCollectorHandler({ client, model: TaxCollector });

		for (const [ key, value ] of Object.entries(db)) {
			this[key] = value;

			// add 'client' to all db models
			if (Object.getPrototypeOf(value) === db.Sequelize.Model) {
				Object.defineProperty(value.prototype, 'client', { value: client });
			}
		}
	}

	/**
	 * loads all db caches
	 */
	async loadCache() {
		return Promise.all([
			this.bannedUsers.loadCache(),
			this.config.loadCache(),
			this.cronJobs.loadCache(),
			this.hypixelGuilds.loadCache(),
			this.players.loadCache(),
			this.taxCollectors.loadCache(),
		]);
	}

	/**
	 * sweeps all db caches
	 */
	sweepCache() {
		this.bannedUsers.sweepCache();
		this.config.sweepCache();
		this.cronJobs.sweepCache();
		this.hypixelGuilds.sweepCache();
		this.players.sweepCache();
		this.taxCollectors.sweepCache();
	}
}

module.exports = DatabaseHandler;
