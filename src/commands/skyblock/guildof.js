import { Constants } from 'discord.js';
import { mojang } from '../../api/mojang.js';
import { hypixel } from '../../api/hypixel.js';
import { DualCommand } from '../../structures/commands/DualCommand.js';
import { logger } from '../../functions/logger.js';


export default class GuildOfCommand extends DualCommand {
	constructor(data) {
		super(
			data,
			{
				aliases: [],
				description: 'shows a player\'s current hypixel guild',
				options: [{
					name: 'ign',
					type: Constants.ApplicationCommandOptionTypes.STRING,
					description: 'IGN | UUID',
					required: true,
				}],
				cooldown: 1,
			},
			{
				aliases: [ 'guild' ],
				args: 1,
				usage: '[`IGN`]',
			},
		);
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
	async run(interaction) {
		this.deferReply(interaction);

		return await this.reply(interaction, await this.#generateReply(interaction.options.getString('ign', true)));
	}

	/**
	 * execute the command
	 * @param {import('../../structures/chat_bridge/HypixelMessage').HypixelMessage} message
	 */
	async runInGame(message) {
		return await message.reply(await this.#generateReply(...message.commandData.args));
	}
}
