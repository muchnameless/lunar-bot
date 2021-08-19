/**
 * @param {import('../ChatBridge').ChatBridge} chatBridge
 */
export default function(chatBridge) {
	chatBridge.emit('disconnect', 'bot end');
}
