import { ChannelType, Events, type ClientEvents } from 'discord.js';
import { HypixelMessageType, slowMode } from '#chatBridge/constants/index.js';
import { logger } from '#logger';
import { DiscordJSEvent } from '#structures/events/DiscordJSEvent.js';

export default class extends DiscordJSEvent {
	public override readonly name = Events.ChannelUpdate;

	/**
	 * event listener callback
	 *
	 * @param oldChannel
	 * @param newChannel
	 */
	public override run(
		oldChannel: ClientEvents[Events.ChannelUpdate][0],
		newChannel: ClientEvents[Events.ChannelUpdate][1],
	) {
		// ignore non ChatBridge channels
		if (!this.client.chatBridges.channelIds.has(newChannel.id)) return;

		// ignore non guild or text-based channels
		if (newChannel.type === ChannelType.DM || !newChannel.isTextBased()) return;

		// no slow chat change
		if ((oldChannel as typeof newChannel).rateLimitPerUser === newChannel.rateLimitPerUser) return;

		// sync slow chat
		for (const chatBridge of this.client.chatBridges.cache) {
			// only sync with the /gc channel
			if (chatBridge.discord.channelsByType.get(HypixelMessageType.Guild)?.channelId !== newChannel.id) continue;

			// skip bridges which are not linked
			const { hypixelGuild } = chatBridge;
			if (!hypixelGuild?.chatBridgeEnabled) continue;

			// skip channels which are already in sync
			if (hypixelGuild.slowChatEnabled ? newChannel.rateLimitPerUser !== 0 : newChannel.rateLimitPerUser === 0) {
				continue;
			}

			// toggle slow chat
			chatBridge.minecraft
				.command({
					command: 'guild slow',
					responseRegExp: slowMode(chatBridge.minecraft.botUsername ?? undefined),
					max: 1,
				})
				.catch((error) => logger.error(error, '[CHANNEL UPDATE]'));
		}
	}
}
