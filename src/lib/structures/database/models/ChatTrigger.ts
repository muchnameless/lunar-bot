import { setTimeout } from 'node:timers';
import { Collection } from 'discord.js';
import {
	Model,
	DataTypes,
	type CreationOptional,
	type InferAttributes,
	type InferCreationAttributes,
	type InstanceDestroyOptions,
	type ModelStatic,
	type NonAttribute,
	type Sequelize,
} from 'sequelize';
import type { HypixelUserMessage } from '#chatBridge/HypixelMessage.js';
import { NEVER_MATCHING_REGEXP } from '#constants';
import type { LunarClient } from '#structures/LunarClient.js';

export class ChatTrigger extends Model<InferAttributes<ChatTrigger>, InferCreationAttributes<ChatTrigger>> {
	public declare readonly client: NonAttribute<LunarClient>;

	public declare regExpString: string;

	public declare response: string;

	public declare cooldown: number;

	public declare chatTypes: string[];

	public declare createdAt: CreationOptional<Date>;

	public declare updatedAt: CreationOptional<Date>;

	private readonly timestamps: Collection<string, number> | null;

	private _regExp: RegExp | null;

	public constructor(...args: any[]) {
		super(...args);

		this._regExp = this.regExpString.includes('{') ? null : new RegExp(this.regExpString, 'i');
		this.timestamps = this.cooldown === 0 ? null : new Collection();
	}

	public static initialise(sequelize: Sequelize) {
		return this.init(
			{
				regExpString: {
					type: DataTypes.TEXT,
					allowNull: false,
					set(value: string) {
						(this as ChatTrigger)._regExp = value.includes('{') ? null : new RegExp(value, 'i');
						this.setDataValue('regExpString', value);
					},
				},
				response: {
					type: DataTypes.TEXT,
					allowNull: false,
				},
				cooldown: {
					type: DataTypes.INTEGER,
					allowNull: false,
					defaultValue: 0,
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
				hypixelMessage.chatBridge.minecraft.botUsername?.replaceAll('_', '[_ ]?') ?? NEVER_MATCHING_REGEXP,
			),
			'i',
		);
	}

	/**
	 * @param hypixelMessage
	 */
	public testMessage(hypixelMessage: HypixelUserMessage) {
		if (!this.chatTypes.includes(hypixelMessage.type)) return null;

		const matched = this._getRegExp(hypixelMessage).exec(hypixelMessage.content);

		if (!matched) return null;

		// cooldowns
		if (this.timestamps) {
			if (
				this.timestamps.has(hypixelMessage.author.ign) &&
				Date.now() < this.timestamps.get(hypixelMessage.author.ign)! + this.cooldown
			) {
				return null;
			}

			this.timestamps.set(hypixelMessage.author.ign, Date.now());
			setTimeout(() => this.timestamps!.delete(hypixelMessage.author.ign), this.cooldown);
		}

		return hypixelMessage.reply(
			this.response
				.replaceAll('{AUTHOR_IGN}', hypixelMessage.author.ign)
				.replaceAll(/\$(\d+)/g, (total, p0) => matched[p0] ?? total), // replace $number with capture group #number
		);
	}

	/**
	 * destroys the db entry and removes it from cache
	 */
	public override async destroy(options?: InstanceDestroyOptions) {
		this.client.chatTriggers.cache.delete(this[this.client.chatTriggers.primaryKey] as string);
		return super.destroy(options);
	}
}

export default ChatTrigger;
