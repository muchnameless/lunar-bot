import { HypixelMessage } from '../structures/chat_bridge/HypixelMessage';
import { UserUtil } from '../util';
import { mojang } from '../api';
import type { HypixelUserMessage } from '../structures/chat_bridge/HypixelMessage';
import type { Interaction } from 'discord.js';

/**
 * message, args -> ign, uuid
 * @param ctx
 * @param ignOrUuid
 */
export async function getUuidAndIgn(ctx: Interaction<'cachedOrDM'> | HypixelUserMessage, ignOrUuid?: string | null) {
	// remove non-alphanumeric characters
	const IGN_OR_UUID = ignOrUuid?.replace(/\W/g, '');

	// ign is first arg
	if (IGN_OR_UUID) return mojang.ignOrUuid(IGN_OR_UUID);

	// no args -> try to get player object
	const IS_HYPIXEL_MESSAGE = ctx instanceof HypixelMessage;

	// author is linked to player
	const player = IS_HYPIXEL_MESSAGE ? ctx.author.player : UserUtil.getPlayer(ctx.user);
	if (player) {
		return {
			uuid: player.minecraftUuid,
			ign: player.ign,
		};
	}

	// no linked player -> try to get ign from author (HypixelMessageAuthor)
	if (IS_HYPIXEL_MESSAGE) return mojang.ign(ctx.author.ign);

	// user linked to uncached player
	const fetchedPlayer = await ctx.client.players.model.findOne({
		where: { discordId: ctx.user.id },
		attributes: ['minecraftUuid'],
	});
	if (fetchedPlayer) return mojang.uuid(fetchedPlayer.minecraftUuid);

	// errors
	if (!ignOrUuid) throw `no linked player for \`${ctx.user.tag}\` found`;

	throw `\`${ignOrUuid}\` is not a valid IGN or UUID`;
}
