import type { TextChannel } from 'discord.js';
import type { HypixelGuild } from '../database/models/HypixelGuild';

export class WebhookError extends Error {
	channel: TextChannel;
	hypixelGuild: HypixelGuild;

	/**
	 * @param message
	 * @param channel
	 * @param hypixelGuild
	 */
	constructor(message: string, channel: TextChannel, hypixelGuild: HypixelGuild) {
		super(message);

		this.name = 'WebhookError';
		this.channel = channel;
		this.hypixelGuild = hypixelGuild;
	}
}
