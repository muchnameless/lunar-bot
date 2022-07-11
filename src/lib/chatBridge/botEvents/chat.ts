import { HypixelMessage } from '../HypixelMessage';
import { ChatBridgeEvent } from '../ChatBridge';
import type { ChatBridge } from '../ChatBridge';
import type { MESSAGE_POSITIONS } from '../constants';

export interface ChatPacket {
	message: string;
	position: keyof typeof MESSAGE_POSITIONS;
}

/**
 * @param chatBridge
 * @param packet
 */
export default async function (chatBridge: ChatBridge, packet: ChatPacket) {
	chatBridge.emit(ChatBridgeEvent.Message, await new HypixelMessage(chatBridge, packet).init());
}
