'use strict';

/**
 * checks if the string is a number
 * @param {string} string
 */
module.exports.validateNumber = string => /^\d+$/.test(string);

/**
 * checks if the string can be a discord tag
 * @param {string} string
 */
module.exports.validateDiscordTag = string => /^.{2,32}#\d{4}$/.test(string);

/**
 * checks if the string can be a minecraft IGN
 * @param {string} string
 */
module.exports.validateMinecraftIGN = string => /^\w{1,16}$/.test(string);

/**
 * checks if the string can be a minecraft IGN
 * @param {string} string
 */
module.exports.validateMinecraftUUID = string => /^[0-9a-f]{8}-?(?:[0-9a-f]{4}-?){3}[0-9a-f]{12}$/i.test(string);
