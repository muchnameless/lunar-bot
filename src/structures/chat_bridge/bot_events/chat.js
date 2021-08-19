import { HypixelMessage } from '../HypixelMessage.js';

/**
 * @typedef {object} ChatPacket
 * @property {string} message
 * @property {number} position
 */

/**
 * @param {import('../ChatBridge').ChatBridge} chatBridge
 * @param {ChatPacket} packet
 */
export default async function(chatBridge, packet) {
	chatBridge.emit('message', await new HypixelMessage(chatBridge, packet).init());
}
