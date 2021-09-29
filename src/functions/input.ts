import { Interaction } from 'discord.js';
import { HypixelMessage } from '../structures/chat_bridge/HypixelMessage';
import { UserUtil } from '../util';
import { mojang } from '../api/mojang';
import type { MojangResult } from '../structures/MojangClient';


/**
 * message, args -> ign, uuid
 * @param ctx
 * @param ignOrUuid
 */
export async function getUuidAndIgn(ctx: Interaction | HypixelMessage, ignOrUuid?: string | null): Promise<MojangResult> {
	// remove non-alphanumeric characters
	const IGN_OR_UUID = ignOrUuid?.replace(/\W/g, '');

	// ign is first arg
	if (IGN_OR_UUID) return mojang.ignOrUuid(IGN_OR_UUID);

	// no args -> try to get player object
	const player = ctx instanceof Interaction
		? UserUtil.getPlayer(ctx.user)
		: ctx.author?.player;

	// author is linked to player
	if (player) return {
		uuid: player.minecraftUuid,
		ign: player.ign,
	};

	// no linked player -> try to get ign from author (HypixelMessageAuthor)
	if (ctx instanceof HypixelMessage && ctx.author?.ign) return mojang.ign(ctx.author.ign);

	throw 'no ign specified and you are not in the player db';
}
