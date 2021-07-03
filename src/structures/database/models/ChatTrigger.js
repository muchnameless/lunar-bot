'use strict';

const { Model, DataTypes } = require('sequelize');
const logger = require('../../../functions/logger');


module.exports = class ChatTrigger extends Model {
	constructor(...args) {
		super(...args);

		/**
		 * @type {import('../../LunarClient')}
		 */
		this.client;
		/**
		 * @type {number}
		 */
		this.lastTriggeredAt;
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
	}

	getRegExp(message) {
		if (this._regExp) return this._regExp;

		return new RegExp(
			this.regExpString.replaceAll('{BOT_IGN}', message.chatBridge.bot.ign.replaceAll('_', '[_ ]?')),
			'i',
		);
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
			lastTriggeredAt: {
				type: DataTypes.BIGINT,
				defaultValue: null,
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

	/**
	 * @param {import('../../chat_bridge/HypixelMessage')} message
	 */
	async testMessage(message) {
		if (!this.chatTypes.includes(message.type)) return;

		const matched = this.getRegExp(message).exec(message.content);

		if (!matched) return;
		if (Date.now() < this.lastTriggeredAt + this.cooldown) return;

		this.lastTriggeredAt = Date.now();
		this.save().catch(logger.error);

		return message.reply(
			this.response
				.replaceAll('{AUTHOR_IGN}', message.author.ign)
				.replaceAll(/\$(\d+)/g, (m, p0) => matched[p0] ?? m), // replace $number with capture group #number
		);
	}
};
