import { ChatBridgeEvent, type ChatBridge } from '../ChatBridge.js';
import { HypixelMessage } from '../HypixelMessage.js';

export type ChatPacket = {
	content: string;
	type: number;
};

/**
 * @param packet
 */
export default async function run(this: ChatBridge, packet: ChatPacket) {
	this.emit(ChatBridgeEvent.Message, await new HypixelMessage(this, packet).init());
}
