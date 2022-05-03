import { hideLinkEmbed, hyperlink, SlashCommandBuilder } from 'discord.js';
import { InteractionUtil } from '../../util';
import { seconds } from '../../functions';
import { DualCommand } from '../../structures/commands/DualCommand';
import { sql } from '../../structures/database';
import { logger } from '../../logger';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';
import type { HypixelUserMessage } from '../../structures/chat_bridge/HypixelMessage';

export default class PatchnotesCommand extends DualCommand {
	constructor(context: CommandContext) {
		super(
			context,
			{
				slash: new SlashCommandBuilder().setDescription('shows latest SkyBlock patchnotes'),
				cooldown: seconds(1),
			},
			{
				aliases: [],
				args: false,
				usage: '',
			},
		);
	}

	/**
	 * execute the command
	 */
	private async _generateReply() {
		try {
			const [existing] = await sql<[{ link: string; title: string }]>`
				SELECT link, title FROM "SkyBlockPatchNotes"
				WHERE guid = ${this.config.get('HYPIXEL_FORUM_LAST_GUID')}
			`;

			if (!existing) return 'no patchnotes found';

			return hyperlink(existing.title, hideLinkEmbed(existing.link));
		} catch (error) {
			logger.error(error, '[PATCHNOTES CMD]');

			return `${error}`;
		}
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		return InteractionUtil.reply(interaction, await this._generateReply());
	}

	/**
	 * execute the command
	 * @param hypixelMessage
	 */
	override async minecraftRun(hypixelMessage: HypixelUserMessage) {
		return hypixelMessage.reply(await this._generateReply());
	}
}
