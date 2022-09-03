import { type ClientEvents, type Events } from 'discord.js';
import MessageDeleteEvent from './messageDelete.js';

export default class MessageDeleteBulkEvent extends MessageDeleteEvent {
	/**
	 * event listener callback
	 *
	 * @param messages
	 */
	// @ts-expect-error override
	public override run(
		//
		messages: ClientEvents[Events.MessageBulkDelete][0],
	) {
		for (const message of messages.values()) {
			this._handleDelete(message);
		}
	}
}
