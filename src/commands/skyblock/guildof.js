import { SlashCommandBuilder } from '@discordjs/builders';
import { mojang } from '../../api/mojang.js';
import { hypixel } from '../../api/hypixel.js';
import { requiredIgnOption } from '../../structures/commands/commonOptions.js';
import { InteractionUtil } from '../../util/InteractionUtil.js';
import { DualCommand } from '../../structures/commands/DualCommand.js';
import { logger } from '../../functions/logger.js';


export default class GuildOfCommand extends DualCommand {
	constructor(context) {
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
	 * @param {string} ignOrUuid
	 */
	// eslint-disable-next-line class-methods-use-this
	async #generateReply(ignOrUuid) {
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
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async runSlash(interaction) {
		InteractionUtil.deferReply(interaction);

		return await InteractionUtil.reply(interaction, await this.#generateReply(interaction.options.getString('ign', true)));
	}

	/**
	 * execute the command
	 * @param {import('../../structures/chat_bridge/HypixelMessage').HypixelMessage} hypixelMessage
	 */
	async runMinecraft(hypixelMessage) {
		return await hypixelMessage.reply(await this.#generateReply(...hypixelMessage.commandData.args));
	}
}
