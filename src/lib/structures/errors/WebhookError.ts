import { type TextChannel } from 'discord.js';
import { type HypixelGuild } from '#structures/database/models/HypixelGuild.js';

export class WebhookError extends Error {
	public readonly channel: TextChannel | undefined;

	public readonly hypixelGuild: HypixelGuild;

	/**
	 * @param message
	 * @param channel
	 * @param hypixelGuild
	 */
	public constructor(message: string, channel: TextChannel | undefined, hypixelGuild: HypixelGuild) {
		super(message);

		this.name = 'WebhookError';
		this.channel = channel;
		this.hypixelGuild = hypixelGuild;
	}
}
