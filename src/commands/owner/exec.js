'use strict';

const { Formatters, Constants } = require('discord.js');
const { promisify } = require('util');
const { exec } = require('child_process');
const SlashCommand = require('../../structures/commands/SlashCommand');
const logger = require('../../functions/logger');


module.exports = class ExecCommand extends SlashCommand {
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
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
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

			return interaction.reply({
				embeds: [ responseEmbed ],
			});
		} catch (error) {
			logger.error(error); // should contain code (exit code) and signal (that caused the termination)

			return await interaction.reply({
				content: Formatters.codeBlock('xl', `${error}`),
			});
		}
	}
};
