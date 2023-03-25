import { IGN_DEFAULT } from '#chatBridge/constants/index.js';

const numberRegExp = /^\d+$/;
/**
 * checks if the string is a number
 *
 * @param string
 */
export const validateNumber = (string: string | null): string is `${number}` =>
	string !== null && numberRegExp.test(string);

const discordTagRegExp = /^.{2,32}#\d{4}$/s;
/**
 * checks if the string can be a discord tag
 *
 * @param string
 */
export const validateDiscordTag = (string: string): string is `${string}#${number}` => discordTagRegExp.test(string);

const discordIdRegExp = /^\d{17,20}$/;
/**
 * checks if the string can be a discord ID
 *
 * @param string
 */
export const validateDiscordId = (string: string): string is `${bigint}` => discordIdRegExp.test(string);

const ignRegExp = new RegExp(`^${IGN_DEFAULT}$`);
/**
 * checks if the string can be a minecraft IGN
 *
 * @param string
 */
export const validateMinecraftIgn = (string: string) => ignRegExp.test(string);

const minecraftUuidRegExp = /^[\da-f]{8}-?(?:[\da-f]{4}-?){3}[\da-f]{12}$/i;
/**
 * checks if the string can be a minecraft IGN
 *
 * @param string
 */
export const validateMinecraftUuid = (string: string) => minecraftUuidRegExp.test(string);
