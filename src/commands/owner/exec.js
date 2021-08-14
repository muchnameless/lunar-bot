import { Formatters, Constants } from 'discord.js';
import { promisify } from 'util';
import { exec } from 'child_process';
import { SlashCommand } from '../../structures/commands/SlashCommand.js';
import { logger } from '../../functions/logger.js';


export default class ExecCommand extends SlashCommand {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'executes bash code',
			options: [{
				name: 'input',
				type: Constants.ApplicationCommandOptionTypes.STRING,
				description: 'code input',
				required: true,
			}],
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async run(interaction) {
		try {
			const INPUT = interaction.options.getString('input', true);
			const { stdout, stderr } = await promisify(exec)(INPUT);
			const responseEmbed = this.client.defaultEmbed
				.addFields({
					name: 'Input',
					value: Formatters.codeBlock('bash', INPUT),
				})
				.setFooter(interaction.guild?.me.displayName ?? this.client.user.username, this.client.user.displayAvatarURL());

			if (stdout) {
				logger.info(stdout);

				responseEmbed.addFields({
					name: 'Output',
					value: Formatters.codeBlock('bash', stdout),
				});
			}

			if (stderr) {
				logger.error(stderr);

				responseEmbed.addFields({
					name: stderr.name ?? 'Error',
					value: Formatters.codeBlock('xl', stderr.message),
				});
			}

			return this.reply(interaction, {
				embeds: [ responseEmbed ],
			});
		} catch (error) {
			logger.error(error); // should contain code (exit code) and signal (that caused the termination)

			return await this.reply(interaction, {
				content: Formatters.codeBlock('xl', `${error}`),
			});
		}
	}
}
