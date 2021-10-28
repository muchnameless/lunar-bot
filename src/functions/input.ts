import { HypixelMessage } from '../structures/chat_bridge/HypixelMessage';
import { UserUtil } from '../util';
import { mojang } from '../api';
import type { HypixelUserMessage } from '../structures/chat_bridge/HypixelMessage';
import type { Interaction } from 'discord.js';
import type { MojangResult } from '../structures/MojangClient';


/**
 * message, args -> ign, uuid
 * @param ctx
 * @param ignOrUuid
 */
export function getUuidAndIgn(ctx: Interaction | HypixelUserMessage, ignOrUuid?: string | null): Promise<MojangResult> {
	// remove non-alphanumeric characters
	const IGN_OR_UUID = ignOrUuid?.replace(/\W/g, '');

	// ign is first arg
	if (IGN_OR_UUID) return mojang.ignOrUuid(IGN_OR_UUID);

	// no args -> try to get player object
	const IS_HYPIXEL_MESSAGE = ctx instanceof HypixelMessage;
	const player = IS_HYPIXEL_MESSAGE
		? ctx.author.player
		: UserUtil.getPlayer(ctx.user);

	// author is linked to player
	if (player) return Promise.resolve({
		uuid: player.minecraftUuid,
		ign: player.ign,
	});

	// no linked player -> try to get ign from author (HypixelMessageAuthor)
	if (IS_HYPIXEL_MESSAGE) return mojang.ign(ctx.author.ign);

	if (!ignOrUuid) return Promise.reject(`no linked player for \`${ctx.user.tag}\` found`);

	return Promise.reject(`\`${ignOrUuid}\` is not a valid IGN or UUID`);
}
