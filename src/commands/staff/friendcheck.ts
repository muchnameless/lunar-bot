import { SlashCommandBuilder } from '@discordjs/builders';
import { Formatters } from 'discord.js';
import { EMBED_DESCRIPTION_MAX_CHARS } from '../../constants';
import { hypixel, mojang } from '../../api';
import { hypixelGuildOption, requiredIgnOption } from '../../structures/commands/commonOptions';
import { InteractionUtil } from '../../util';
import { escapeIgn, seconds, trim } from '../../functions';
import { ApplicationCommand } from '../../structures/commands/ApplicationCommand';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';

export default class FriendCheckCommand extends ApplicationCommand {
	constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder()
				.setDescription('checks which friends of the player are in the guild')
				.addStringOption(requiredIgnOption)
				.addStringOption(hypixelGuildOption),
			cooldown: seconds(1),
		});
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		const { uuid, ign: IGN } = await mojang.ignOrUuid(interaction.options.getString('ign', true));
		const friends = new Set(
			(await hypixel.friends.uuid(uuid)).map((x) => (x.uuidSender === uuid ? x.uuidReceiver : x.uuidSender)),
		);
		const hypixelGuild = InteractionUtil.getHypixelGuild(interaction);

		let friendsInGuild = '';

		for (const player of hypixelGuild.players.values()) {
			if (friends.has(player.minecraftUuid)) friendsInGuild += `${player}\n`;
		}

		return InteractionUtil.reply(interaction, {
			embeds: [
				this.client.defaultEmbed
					.setTitle(`${escapeIgn(IGN)}'s friends in ${hypixelGuild}`)
					.setDescription(
						Formatters.codeBlock(trim(friendsInGuild || '-- none --', EMBED_DESCRIPTION_MAX_CHARS - '```\n```'.length)),
					)
					.setFooter({ text: hypixelGuild.name }),
			],
		});
	}
}
