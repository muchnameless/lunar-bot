import { Constants } from 'discord.js';
import { DualCommand } from '../../structures/commands/DualCommand.js';
// import { logger } from '../../functions/logger.js';


export default class SmiteCommand extends DualCommand {
	constructor(data) {
		super(
			data,
			{
				aliases: [],
				description: 'guild mute for 10 minutes',
				options: [{
					name: 'target',
					type: Constants.ApplicationCommandOptionTypes.STRING,
					description: 'IGN | UUID | discord ID | @mention | \'guild\' | \'everyone\'',
					required: true,
				},
				DualCommand.guildOptionBuilder(data.client, false),
				],
				cooldown: 0,
			},
			{
				aliases: [],
				args: 1,
				usage: '[`IGN`]',
			},
		);
	}

	/**
	 * execute the command
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async run(interaction) {
		/** @type {import('../guild/guild')} */
		const guildCommand = this.client.commands.get('guild');

		return await guildCommand.runMuteInteraction(interaction, 10 * 60_000);
	}

	/**
	 * execute the command
	 * @param {import('../../structures/chat_bridge/HypixelMessage').HypixelMessage} hypixelMessage
	 */
	async runInGame(hypixelMessage) {
		/** @type {import('../guild/guild')} */
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
