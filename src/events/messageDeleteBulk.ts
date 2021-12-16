import MessageDeleteEvent from './messageDelete';
import type { Collection, Message, Snowflake } from 'discord.js';
import type { EventContext } from '../structures/events/BaseEvent';

export default class MessageDeleteBulkEvent extends MessageDeleteEvent {
	constructor(context: EventContext) {
		super(context, {
			once: false,
			enabled: true,
		});
	}

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
