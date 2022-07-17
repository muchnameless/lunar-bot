import MessageDeleteEvent from './messageDelete';
import type { ClientEvents, Events } from 'discord.js';

export default class MessageDeleteBulkEvent extends MessageDeleteEvent {
	/**
	 * event listener callback
	 * @param messages
	 */
	// @ts-expect-error
	override run(
		//
		messages: ClientEvents[Events.MessageBulkDelete][0],
	) {
		for (const message of messages.values()) {
			this._handleDelete(message);
		}
	}
}
