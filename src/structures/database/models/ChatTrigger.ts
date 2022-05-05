import { setTimeout } from 'node:timers';
import { Collection } from 'discord.js';
import { Model, DataTypes } from 'sequelize';
import { NEVER_MATCHING_REGEXP } from '../../../constants';
import type {
	CreationOptional,
	InferAttributes,
	InferCreationAttributes,
	InstanceDestroyOptions,
	ModelStatic,
	NonAttribute,
	Sequelize,
} from 'sequelize';
import type { HypixelUserMessage } from '../../chat_bridge/HypixelMessage';
import type { LunarClient } from '../../LunarClient';

export class ChatTrigger extends Model<InferAttributes<ChatTrigger>, InferCreationAttributes<ChatTrigger>> {
	declare client: NonAttribute<LunarClient>;

	declare regExpString: string;
	declare response: string;
	declare cooldown: number | null;
	declare chatTypes: string[];

	declare createdAt: CreationOptional<Date>;
	declare updatedAt: CreationOptional<Date>;

	private timestamps: Collection<string, number> | null;
	private _regExp: RegExp | null;

	constructor(...args: any[]) {
		super(...args);

		this._regExp = this.regExpString.includes('{') ? null : new RegExp(this.regExpString, 'i');
		this.timestamps = this.cooldown !== 0 ? new Collection() : null;
	}

	static initialise(sequelize: Sequelize) {
		return this.init(
			{
				regExpString: {
					type: DataTypes.TEXT,
					allowNull: false,
					set(value: string) {
						(this as ChatTrigger)._regExp = value.includes('{') ? null : new RegExp(value, 'i');
						return this.setDataValue('regExpString', value);
					},
				},
				response: {
					type: DataTypes.TEXT,
					allowNull: false,
				},
				cooldown: {
					type: DataTypes.INTEGER,
					allowNull: true,
				},
				chatTypes: {
					type: DataTypes.ARRAY(DataTypes.TEXT),
					allowNull: false,
				},
				createdAt: DataTypes.DATE,
				updatedAt: DataTypes.DATE,
			},
			{
				sequelize,
			},
		) as ModelStatic<ChatTrigger>;
	}

	/**
	 * @param hypixelMessage
	 */
	private _getRegExp(hypixelMessage: HypixelUserMessage) {
		if (this._regExp) return this._regExp;

		return new RegExp(
			this.regExpString.replaceAll(
				'{BOT_IGN}',
				hypixelMessage.chatBridge.bot?.username.replaceAll('_', '[_ ]?') ?? NEVER_MATCHING_REGEXP,
			),
			'i',
		);
	}

	/**
	 * @param hypixelMessage
	 */
	testMessage(hypixelMessage: HypixelUserMessage) {
		if (!this.chatTypes.includes(hypixelMessage.type)) return;

		const matched = this._getRegExp(hypixelMessage).exec(hypixelMessage.content);

		if (!matched) return;

		// cooldowns
		if (this.timestamps) {
			if (
				this.timestamps.has(hypixelMessage.author.ign) &&
				Date.now() < this.timestamps.get(hypixelMessage.author.ign)! + this.cooldown!
			) {
				return;
			}

			this.timestamps.set(hypixelMessage.author.ign, Date.now());
			setTimeout(() => this.timestamps!.delete(hypixelMessage.author.ign), this.cooldown!);
		}

		return hypixelMessage.reply(
			this.response
				.replaceAll('{AUTHOR_IGN}', hypixelMessage.author.ign)
				.replaceAll(/\$(\d+)/g, (m, p0) => matched[p0] ?? m), // replace $number with capture group #number
		);
	}

	/**
	 * destroys the db entry and removes it from cache
	 */
	override destroy(options?: InstanceDestroyOptions) {
		this.client.chatTriggers.cache.delete(this[this.client.chatTriggers.primaryKey] as string);
		return super.destroy(options);
	}
}

export default ChatTrigger;
