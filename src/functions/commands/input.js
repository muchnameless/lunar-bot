'use strict';

const mojang = require('../../api/mojang');


/**
 * message, args -> ign, uuid
 * @param {import('../../structures/extensions/Message')|import('../../structures/chat_bridge/HypixelMessage')} message
 * @param {string[]} args
 * @returns {Promise<{ uuid: string, ign: string }>}
 */
module.exports.getUuidAndIgn = async (message, args) => {
	// ign is first arg
	if (args.length) return mojang.ign(args[0]);

	// no args -> try to get player object
	const { player } = message.author;

	// author is linked to player
	if (player) return {
		uuid: player.minecraftUUID,
		ign: player.ign,
	};

	// no linked player -> try to get ign from author (HypixelMessageAuthor)
	const { ign } = message.author;

	if (ign) return mojang.ign(ign);

	throw new Error('no ign specified and you are not in the player db');
};
