import MessageDeleteEvent from './messageDelete';
import type { Collection, Message, Snowflake } from 'discord.js';

export default class MessageDeleteBulkEvent extends MessageDeleteEvent {
	/**
	 * event listener callback
	 * @param messages
	 */
	// @ts-expect-error
	override run(messages: Collection<Snowflake, Message>) {
		for (const message of messages.values()) {
			this._handleDelete(message);
		}
	}
}
