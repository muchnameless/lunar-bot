import { Interaction } from 'discord.js';
import { UserUtil } from '../util/index.js';
import { mojang } from '../api/mojang.js';


/**
 * message, args -> ign, uuid
 * @param {import('discord.js').Interaction | import('../structures/chat_bridge/HypixelMessage').HypixelMessage} ctx
 * @param {string} ignOrUuid
 * @returns {Promise<import('../structures/Mojang').MojangResult>}
 */
export async function getUuidAndIgn(ctx, ignOrUuid) {
	// remove non-alphanumeric characters
	const IGN_OR_UUID = ignOrUuid?.replace(/\W/g, '');

	// ign is first arg
	if (IGN_OR_UUID) return mojang.ignOrUuid(IGN_OR_UUID);

	// no args -> try to get player object
	const player = ctx instanceof Interaction
		? UserUtil.getPlayer(ctx.user)
		: ctx.author.player;

	// author is linked to player
	if (player) return {
		uuid: player.minecraftUuid,
		ign: player.ign,
	};

	// no linked player -> try to get ign from author (HypixelMessageAuthor)
	const { ign } = ctx.author ?? {};

	if (ign) return mojang.ign(ign);

	throw 'no ign specified and you are not in the player db';
}
