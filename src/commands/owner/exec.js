'use strict';

const { Constants } = require('discord.js');
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
			defaultPermission: true,
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) {
		try {
			const { stdout, stderr } = await promisify(exec)(interaction.options.get('input').value);

			if (stdout) {
				logger.info(stdout);
				await interaction.reply({
					content: stdout,
					code: 'bash',
					editPreviousMessage: true,
				});
			}

			if (stderr) {
				logger.error(stderr);
				await interaction.reply({
					content: `${stderr.name}: ${stderr.message}`,
					code: 'xl',
					editPreviousMessage: false,
				});
			}
		} catch (error) {
			logger.error(error); // should contain code (exit code) and signal (that caused the termination)
			return interaction.reply({
				content: `${error}`,
				code: 'xl',
			});
		}
	}
};
