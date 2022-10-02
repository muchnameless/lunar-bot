import { ChatBridgeEvent, type ChatBridge } from '../ChatBridge.js';
import { HypixelMessage } from '../HypixelMessage.js';

export type ChatPacket = {
	content: string;
	type: number;
};

/**
 * hypixel uses this event for all messages instead of player_chat for player messages
 *
 * @param packet
 */
export default async function run(this: ChatBridge, packet: ChatPacket) {
	this.emit(ChatBridgeEvent.Message, await new HypixelMessage(this, packet).init());
}
