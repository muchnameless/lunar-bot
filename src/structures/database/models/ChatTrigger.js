'use strict';

const { Collection } = require('discord.js');
const { Model, DataTypes } = require('sequelize');
// const logger = require('../../../functions/logger');


module.exports = class ChatTrigger extends Model {
	constructor(...args) {
		super(...args);

		/**
		 * @type {import('../../LunarClient')}
		 */
		this.client;
		/**
		 * @type {string[]}
		 */
		this.chatTypes;
		/**
		 * @type {?number}
		 */
		this.cooldown;
		/**
		 * @type {string}
		 */
		this.regExpString;
		/**
		 * @type {?RegExp}
		 */
		this._regExp = this.regExpString.includes('{')
			? null
			: new RegExp(this.regExpString, 'i');
		/**
		 * @type {Collection<string, number>}
		 */
		this.timestamps = this.cooldown !== 0
			? new Collection()
			: null;
	}

	/**
	 * @param {import('sequelize')} sequelize
	 */
	static init(sequelize) {
		return super.init({
			regExpString: {
				type: DataTypes.STRING,
				allowNull: false,
				set(value) {
					this._regExp = value.includes('{')
						? null
						: new RegExp(value, 'i');
					return this.setDataValue('regExpString', value);
				},
			},
			response: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			cooldown: {
				type: DataTypes.INTEGER,
				allowNull: true,
			},
			chatTypes: {
				type: DataTypes.ARRAY(DataTypes.STRING),
				allowNull: false,
			},
		}, {
			sequelize,
			modelName: 'ChatTrigger',
		});
	}

	getRegExp(message) {
		if (this._regExp) return this._regExp;

		return new RegExp(
			this.regExpString.replaceAll('{BOT_IGN}', message.chatBridge.bot.username.replaceAll('_', '[_ ]?')),
			'i',
		);
	}

	/**
	 * @param {import('../../chat_bridge/HypixelMessage')} message
	 */
	async testMessage(message) {
		if (!this.chatTypes.includes(message.type)) return;

		const matched = this.getRegExp(message).exec(message.content);

		if (!matched) return;

		// cooldowns
		if (this.cooldown !== 0) {
			if (this.timestamps.has(message.author.ign) && Date.now() < this.timestamps.get(message.author.ign) + this.cooldown) return;

			this.timestamps.set(message.author.ign, Date.now());
			setTimeout(() => this.timestamps.delete(message.author.ign), this.cooldown);
		}

		return await message.reply(
			this.response
				.replaceAll('{AUTHOR_IGN}', message.author.ign)
				.replaceAll(/\$(\d+)/g, (m, p0) => matched[p0] ?? m), // replace $number with capture group #number
		);
	}
};
