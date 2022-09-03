import { type ClientEvents, type Events } from 'discord.js';
import { Event } from '#structures/events/Event.js';

export default class MessageDeleteEvent extends Event {
	/**
	 * @param message
	 */
	protected _handleDelete(message: ClientEvents[Events.MessageDelete][0]) {
		this.client.chatBridges.handleMessageDelete(message);

		if (message.id === this.config.get('TAX_MESSAGE_ID')) void this.config.set('TAX_MESSAGE_ID', null);
	}

	/**
	 * event listener callback
	 *
	 * @param message
	 */
	public override run(message: ClientEvents[Events.MessageDelete][0]) {
		this._handleDelete(message);
	}
}
