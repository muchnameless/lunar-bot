import { SlashCommandBuilder } from '@discordjs/builders';
import { mojang } from '../../api/mojang';
import { hypixel } from '../../api/hypixel';
import { requiredIgnOption } from '../../structures/commands/commonOptions';
import { InteractionUtil } from '../../util';
import { logger } from '../../functions';
import { DualCommand } from '../../structures/commands/DualCommand';
import type { CommandInteraction } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';
import type { HypixelMessage } from '../../structures/chat_bridge/HypixelMessage';


export default class GuildOfCommand extends DualCommand {
	constructor(context: CommandContext) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('shows a player\'s current hypixel guild')
				.addStringOption(requiredIgnOption),
			cooldown: 1,
		}, {
			aliases: [ 'guild' ],
			args: 1,
			usage: '[`IGN`]',
		});
	}

	/**
	 * execute the command
	 * @param ignOrUuid
	 */
	// eslint-disable-next-line class-methods-use-this
	async #generateReply(ignOrUuid: string) {
		try {
			const { uuid, ign } = await mojang.ignOrUuid(ignOrUuid);
			const { name, tag, members } = await hypixel.guild.player(uuid);

			if (!name) return `${ign}: no guild`;

			return `${ign}: ${name}${tag ? ` [${tag}]` : ''} ${members.length}/125 members`;
		} catch (error) {
			logger.error('[GUILDOF CMD]', error);

			return `${error}`;
		}
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async runSlash(interaction: CommandInteraction) {
		return await InteractionUtil.reply(interaction, await this.#generateReply(interaction.options.getString('ign', true)));
	}

	/**
	 * execute the command
	 * @param hypixelMessage
	 */
	override async runMinecraft(hypixelMessage: HypixelMessage) {
		return await hypixelMessage.reply(await this.#generateReply(...hypixelMessage.commandData!.args));
	}
}
