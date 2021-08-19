import { SlashCommandBuilder } from '@discordjs/builders';
import { Formatters } from 'discord.js';
import { promisify } from 'util';
import { exec } from 'child_process';
import { InteractionUtil } from '../../util/InteractionUtil.js';
import { SlashCommand } from '../../structures/commands/SlashCommand.js';
import { logger } from '../../functions/logger.js';


export default class ExecCommand extends SlashCommand {
	constructor(context) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('executes bash code')
				.addStringOption(option => option
					.setName('input')
					.setDescription('bash code')
					.setRequired(true),
				),
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async runSlash(interaction) {
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

			return InteractionUtil.reply(interaction, {
				embeds: [ responseEmbed ],
			});
		} catch (error) {
			logger.error(error); // should contain code (exit code) and signal (that caused the termination)

			return await InteractionUtil.reply(interaction, {
				content: Formatters.codeBlock('xl', `${error}`),
			});
		}
	}
}
