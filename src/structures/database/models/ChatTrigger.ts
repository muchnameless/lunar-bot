import { Collection } from 'discord.js';
import pkg from 'sequelize';
const { Model, DataTypes } = pkg;
import type { ModelStatic, Sequelize } from 'sequelize';
import type { HypixelMessage } from '../../chat_bridge/HypixelMessage';
import type { LunarClient } from '../../LunarClient';


interface ChatTriggerAttributes {
	regExpString: string;
	response: string;
	cooldown: number | null;
	chatTypes: string[];
}


export class ChatTrigger extends Model<ChatTriggerAttributes> implements ChatTriggerAttributes {
	declare client: LunarClient;;

	declare regExpString: string;
	declare response: string;
	declare cooldown: number | null;
	declare chatTypes: string[];
	private timestamps: Collection<string, number> | null;
	private _regExp: RegExp | null;

	declare readonly createdAt: Date;
	declare readonly updatedAt: Date;

	constructor(...args: any[]) {
		super(...args);

		this._regExp = this.regExpString.includes('{')
			? null
			: new RegExp(this.regExpString, 'i');
		this.timestamps = this.cooldown !== 0
			? new Collection()
			: null;
	}

	static initialize(sequelize: Sequelize) {
		return this.init({
			regExpString: {
				type: DataTypes.STRING,
				allowNull: false,
				set(value: string) {
					(this as ChatTrigger)._regExp = value.includes('{')
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
		}) as ModelStatic<ChatTrigger>;
	}

	/**
	 * @param hypixelMessage
	 */
	getRegExp(hypixelMessage: HypixelMessage) {
		if (this._regExp) return this._regExp;

		return new RegExp(
			this.regExpString.replaceAll('{BOT_IGN}', hypixelMessage.chatBridge.bot!.username.replaceAll('_', '[_ ]?')),
			'i',
		);
	}

	/**
	 * @param hypixelMessage
	 */
	async testMessage(hypixelMessage: HypixelMessage) {
		if (!this.chatTypes.includes(hypixelMessage.type!)) return;

		const matched = this.getRegExp(hypixelMessage).exec(hypixelMessage.content);

		if (!matched) return;

		// cooldowns
		if (this.cooldown !== 0) {
			if (this.timestamps!.has(hypixelMessage.author!.ign) && Date.now() < this.timestamps!.get(hypixelMessage.author!.ign)! + this.cooldown!) return;

			this.timestamps!.set(hypixelMessage.author!.ign, Date.now());
			setTimeout(() => this.timestamps!.delete(hypixelMessage.author!.ign), this.cooldown!);
		}

		return await hypixelMessage.reply(
			this.response
				.replaceAll('{AUTHOR_IGN}', hypixelMessage.author!.ign)
				.replaceAll(/\$(\d+)/g, (m, p0) => matched[p0] ?? m), // replace $number with capture group #number
		);
	}
}

export default ChatTrigger;
