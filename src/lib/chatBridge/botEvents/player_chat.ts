import { HypixelMessage } from '../HypixelMessage';
import { ChatBridgeEvent } from '../ChatBridge';
import type { ChatBridge } from '../ChatBridge';

export interface ChatPacket {
	content: string;
	type: number;
}

/**
 * @param chatBridge
 * @param packet
 */
export default async function (chatBridge: ChatBridge, packet: ChatPacket) {
	chatBridge.emit(ChatBridgeEvent.Message, await new HypixelMessage(chatBridge, packet).init());
}
