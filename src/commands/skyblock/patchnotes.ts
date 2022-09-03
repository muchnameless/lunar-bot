import { hideLinkEmbed, hyperlink, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { type HypixelUserMessage } from '#chatBridge/HypixelMessage.js';
import { sql } from '#db';
import { seconds } from '#functions';
import { logger } from '#logger';
import { type CommandContext } from '#structures/commands/BaseCommand.js';
import { DualCommand } from '#structures/commands/DualCommand.js';
import { InteractionUtil } from '#utils';

export default class PatchnotesCommand extends DualCommand {
	public constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder().setDescription('shows latest SkyBlock patchnotes'),
			cooldown: seconds(1),
		});
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
	 *
	 * @param interaction
	 */
	public override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		return InteractionUtil.reply(interaction, await this._generateReply());
	}

	/**
	 * execute the command
	 *
	 * @param hypixelMessage
	 */
	public override async minecraftRun(hypixelMessage: HypixelUserMessage) {
		return hypixelMessage.reply(await this._generateReply());
	}
}
