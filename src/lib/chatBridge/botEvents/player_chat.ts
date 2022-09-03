import { ChatBridgeEvent, type ChatBridge } from '../ChatBridge.js';
import { HypixelMessage } from '../HypixelMessage.js';

export type ChatPacket = {
	content: string;
	type: number;
};

/**
 * @param chatBridge
 * @param packet
 */
export default async function run(chatBridge: ChatBridge, packet: ChatPacket) {
	chatBridge.emit(ChatBridgeEvent.Message, await new HypixelMessage(chatBridge, packet).init());
}
