import { SlashCommandBuilder } from '@discordjs/builders';
import { targetOption, buildGuildOption } from '../../structures/commands/commonOptions.js';
// import { InteractionUtil } from '../../util/InteractionUtil.js';
import { DualCommand } from '../../structures/commands/DualCommand.js';
// import { logger } from '../../functions/logger.js';


export default class SmiteCommand extends DualCommand {
	constructor(context) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('guild mute for 10 minutes')
				.addStringOption(targetOption)
				.addStringOption(buildGuildOption(context.client)),
			cooldown: 0,
		}, {
			aliases: [],
			args: 1,
			usage: '[`IGN`]',
		});
	}

	/**
	 * execute the command
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async runSlash(interaction) {
		/** @type {import('../guild/guild').default} */
		const guildCommand = this.client.commands.get('guild');

		return await guildCommand.runMuteInteraction(interaction, 10 * 60_000);
	}

	/**
	 * execute the command
	 * @param {import('../../structures/chat_bridge/HypixelMessage').HypixelMessage} hypixelMessage
	 */
	async runMinecraft(hypixelMessage) {
		/** @type {import('../guild/guild').default} */
		const guildCommand = this.client.commands.get('guild');
		const TARGET_INPUT = hypixelMessage.commandData.args[0].toLowerCase();
		const target = await guildCommand.getMuteTarget(TARGET_INPUT);

		if (!target) return await hypixelMessage.author.send(`no player with the IGN \`${TARGET_INPUT}\` found`);

		const { content } = await guildCommand.runMute({
			target,
			executor: hypixelMessage.player,
			duration: 10 * 60_000,
			hypixelGuild: hypixelMessage.hypixelGuild,
		});

		return await hypixelMessage.author.send(content);
	}
}
