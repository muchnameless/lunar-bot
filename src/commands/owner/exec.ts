import { promisify } from 'node:util';
import { exec } from 'node:child_process';
import { SlashCommandBuilder } from '@discordjs/builders';
import { ActionRow, Formatters } from 'discord.js';
import { InteractionUtil } from '../../util';
import { buildDeleteButton, logger } from '../../functions';
import { ApplicationCommand } from '../../structures/commands/ApplicationCommand';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';

export default class ExecCommand extends ApplicationCommand {
	constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder() //
				.setDescription('executes bash code')
				.addStringOption((option) =>
					option //
						.setName('input')
						.setDescription('bash code')
						.setRequired(true),
				),
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async runSlash(interaction: ChatInputCommandInteraction) {
		try {
			const me = interaction.guild?.me ?? null;
			const INPUT = interaction.options.getString('input', true);
			const { stdout, stderr } = await promisify(exec)(INPUT);
			const responseEmbed = this.client.defaultEmbed
				.addFields({
					name: 'Input',
					value: Formatters.codeBlock('bash', INPUT),
				})
				.setFooter({
					text: me?.displayName ?? this.client.user!.username,
					iconURL: (me ?? this.client.user!).displayAvatarURL(),
				});

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
					name: stderr,
					value: Formatters.codeBlock('xl', stderr),
				});
			}

			return InteractionUtil.reply(interaction, {
				embeds: [responseEmbed],
				components: [new ActionRow().addComponents(buildDeleteButton(interaction.user))],
			});
		} catch (error) {
			logger.error(error); // should contain code (exit code) and signal (that caused the termination)

			return InteractionUtil.reply(interaction, {
				content: Formatters.codeBlock('xl', `${error}`),
				components: [new ActionRow().addComponents(buildDeleteButton(interaction.user))],
			});
		}
	}
}
