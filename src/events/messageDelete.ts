import { MessageUtil } from '#utils';
import { Event } from '#structures/events/Event';
import type { ClientEvents, Events } from 'discord.js';

export default class MessageDeleteEvent extends Event {
	/**
	 * @param message
	 */
	protected _handleDelete(message: ClientEvents[Events.MessageDelete][0]) {
		MessageUtil.DELETE_TIMEOUT_CACHE.delete(message.id);
		MessageUtil.DELETED_MESSAGES.add(message);
		if (message.id === this.config.get('TAX_MESSAGE_ID')) void this.config.set('TAX_MESSAGE_ID', null);
	}

	/**
	 * event listener callback
	 * @param message
	 */
	override run(message: ClientEvents[Events.MessageDelete][0]) {
		this._handleDelete(message);
	}
}
