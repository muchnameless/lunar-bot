'use strict';

const { Model } = require('sequelize');


class BannedUser extends Model {
	constructor(...args) {
		super(...args);

		/**
		 * @type {import('../../LunarClient')}
		 */
		this.client;
		/**
		 * @type {string}
		 */
		this.discordID;
		/**
		 * @type {string}
		 */
		this.discordTag;
		/**
		 * @type {string}
		 */
		this.reason;
		/**
		 * @type {number}
		 */
		this.expiresAt;
	}

	/**
	 * Helper method for defining associations.
	 * This method is not a part of Sequelize lifecycle.
	 * The `models/index` file will call this method automatically.
	 */
	static associate(models) {
		// define associations here
	}
}

module.exports = BannedUser;
