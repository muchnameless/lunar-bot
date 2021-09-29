declare module 'prismarine- chat' {
	interface ChatMessage {
		extra?: { clickEvent?: { action: string, value: string } }[]
	}
}
