/**
 * only lower case versions are not blocked by the advertisement filter
 */
export const ALLOWED_URLS_REGEXP = new RegExp(
	[
		'discord.gg',
		'facebook.com',
		'hypixel.net',
		'imgur.com',
		'instagram.com',
		'minecraft.net',
		'reddit.com',
		'tiktok.com',
		'twitter.com',
		'youtu.be',
		'youtube.com',
	]
		.map((x) => `\\b${x}(?:$|\\/)`)
		.join('|'),
);
