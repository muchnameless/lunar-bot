import { MessageCreateOptions, SnowflakeUtil } from 'discord.js';

/**
 * adds a random nonce which dedupes messages
 * @param options
 */
export const addEnforcedNonce = <const T extends MessageCreateOptions>(options: T) =>
	({
		nonce: String(SnowflakeUtil.generate()),
		enforceNonce: true,
		...options,
	}) as const;
