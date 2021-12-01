import { SlashCommandBuilder } from '@discordjs/builders';
import { Formatters } from 'discord.js';
import { stripIndents } from 'common-tags';
import { EMBED_DESCRIPTION_MAX_CHARS } from '../../constants';
import { hypixel, mojang } from '../../api';
import { requiredIgnOption } from '../../structures/commands/commonOptions';
import { InteractionUtil } from '../../util';
import { escapeIgn, seconds, trim } from '../../functions';
import { ApplicationCommand } from '../../structures/commands/ApplicationCommand';
import type { CommandInteraction } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';

export default class FriendCheckCommand extends ApplicationCommand {
	constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder()
				.setDescription('checks which friends of the player are in the guild')
				.addStringOption(requiredIgnOption),
			cooldown: seconds(1),
		});
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async runSlash(interaction: CommandInteraction) {
		const { uuid, ign: IGN } = await mojang.ignOrUuid(interaction.options.getString('ign', true));
		const friends = new Set(
			(await hypixel.friends.uuid(uuid)).map((x) => (x.uuidSender === uuid ? x.uuidReceiver : x.uuidSender)),
		);

		let mutualFriends = '';

		for (const player of this.client.players.cache.values()) {
			if (friends.has(player.minecraftUuid)) mutualFriends += `${escapeIgn(`${player}`)}\n`;
		}

		return InteractionUtil.reply(interaction, {
			embeds: [
				this.client.defaultEmbed.setTitle(`${escapeIgn(IGN)}'s friends in the guild`).setDescription(
					Formatters.codeBlock(stripIndents`
						${trim(mutualFriends, EMBED_DESCRIPTION_MAX_CHARS - '```\n```'.length)}
					`),
				),
			],
		});
	}
}
