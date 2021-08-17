import { Collection } from 'discord.js';
import pkg from 'sequelize';
const { Model, DataTypes } = pkg;
// import { logger } from '../../../functions/logger.js';


export class ChatTrigger extends Model {
	constructor(...args) {
		super(...args);

		/**
		 * @type {import('../../LunarClient').LunarClient}
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
	 * @param {import('sequelize').Sequelize} sequelize
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

	/**
	 * @param {import('../../chat_bridge/HypixelMessage').HypixelMessage} hypixelMessage
	 */
	getRegExp(hypixelMessage) {
		if (this._regExp) return this._regExp;

		return new RegExp(
			this.regExpString.replaceAll('{BOT_IGN}', hypixelMessage.chatBridge.bot.username.replaceAll('_', '[_ ]?')),
			'i',
		);
	}

	/**
	 * @param {import('../../chat_bridge/HypixelMessage').HypixelMessage} hypixelMessage
	 */
	async testMessage(hypixelMessage) {
		if (!this.chatTypes.includes(hypixelMessage.type)) return;

		const matched = this.getRegExp(hypixelMessage).exec(hypixelMessage.content);

		if (!matched) return;

		// cooldowns
		if (this.cooldown !== 0) {
			if (this.timestamps.has(hypixelMessage.author.ign) && Date.now() < this.timestamps.get(hypixelMessage.author.ign) + this.cooldown) return;

			this.timestamps.set(hypixelMessage.author.ign, Date.now());
			setTimeout(() => this.timestamps.delete(hypixelMessage.author.ign), this.cooldown);
		}

		return await hypixelMessage.reply(
			this.response
				.replaceAll('{AUTHOR_IGN}', hypixelMessage.author.ign)
				.replaceAll(/\$(\d+)/g, (m, p0) => matched[p0] ?? m), // replace $number with capture group #number
		);
	}
}

export default ChatTrigger;
