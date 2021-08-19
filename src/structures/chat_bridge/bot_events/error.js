/**
 * @param {import('../ChatBridge').ChatBridge} chatBridge
 * @param {any} error
 */
export default function(chatBridge, error) {
	chatBridge.emit('error', error);
}
