import { SlashCommandBuilder } from '@discordjs/builders';
import { Formatters } from 'discord.js';
import { requiredIgnOption } from '../../structures/commands/commonOptions';
import { InteractionUtil } from '../../util';
import { logger, seconds } from '../../functions';
import { DualCommand } from '../../structures/commands/DualCommand';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';
import type { HypixelUserMessage } from '../../structures/chat_bridge/HypixelMessage';

export default class PatchnotesCommand extends DualCommand {
	constructor(context: CommandContext) {
		super(
			context,
			{
				slash: new SlashCommandBuilder()
					.setDescription('shows latest SkyBlock patchnotes')
					.addStringOption(requiredIgnOption),
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
			const entry = await this.client.db.models.SkyBlockPatchNote.findByPk(this.config.get('HYPIXEL_FORUM_LAST_GUID'), {
				raw: true,
				attributes: ['link'],
			});

			if (!entry) return 'no patchnotes found';

			return Formatters.hideLinkEmbed(entry.link);
		} catch (error) {
			logger.error(error, '[PATCHNOTES CMD]');

			return `${error}`;
		}
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async runSlash(interaction: ChatInputCommandInteraction) {
		return InteractionUtil.reply(interaction, await this._generateReply());
	}

	/**
	 * execute the command
	 * @param hypixelMessage
	 */
	override async runMinecraft(hypixelMessage: HypixelUserMessage) {
		return hypixelMessage.reply(await this._generateReply());
	}
}
