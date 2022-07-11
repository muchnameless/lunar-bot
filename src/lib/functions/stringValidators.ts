import { IGN_DEFAULT } from '#chatBridge/constants';
import type { Snowflake } from 'discord.js';

/**
 * checks if the string is a number
 * @param string
 */
export const validateNumber = (string: string | null): string is `${number}` => /^\d+$/.test(string!);

/**
 * checks if the string can be a discord tag
 * @param string
 */
export const validateDiscordTag = (string: string | null): string is `${string}#${number}` =>
	/^.{2,32}#\d{4}$/s.test(string!);

/**
 * checks if the string can be a discord ID
 * @param string
 */
export const validateDiscordId = (string: unknown): string is Snowflake => /^\d{17,19}$/.test(string as string);

const ignRegExp = new RegExp(`^${IGN_DEFAULT}$`);
/**
 * checks if the string can be a minecraft IGN
 * @param string
 */
export const validateMinecraftIgn = (string: string | null) => ignRegExp.test(string!);

/**
 * checks if the string can be a minecraft IGN
 * @param string
 */
export const validateMinecraftUuid = (string: string | null): string is string =>
	/^[\da-f]{8}-?(?:[\da-f]{4}-?){3}[\da-f]{12}$/i.test(string!);
