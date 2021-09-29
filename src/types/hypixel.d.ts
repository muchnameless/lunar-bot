declare module '@zikeji /hypixel' {
	interface Client {
		rateLimit: { remaining: number, limit: number, reset: number };
	}
}
