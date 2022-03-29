import { MessageUtil } from '../util';
import { Event, type EventContext } from '../structures/events/Event';
import type { Message } from 'discord.js';
import type { EventData } from '../structures/events/BaseEvent';

export default class MessageDeleteEvent extends Event {
	constructor(context: EventContext, data?: EventData) {
		super(
			context,
			data ?? {
				once: false,
				enabled: true,
			},
		);
	}

	/**
	 * @param messageId
	 */
	protected _handleDelete(message: Message) {
		MessageUtil.DELETE_TIMEOUT_CACHE.delete(message.id);
		MessageUtil.DELETED_MESSAGES.add(message);
		if (message.id === this.config.get('TAX_MESSAGE_ID')) void this.config.set('TAX_MESSAGE_ID', null);
	}

	/**
	 * event listener callback
	 * @param message
	 */
	override run(message: Message) {
		this._handleDelete(message);
	}
}
