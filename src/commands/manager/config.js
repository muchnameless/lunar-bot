'use strict';

const { Constants } = require('discord.js');
const SlashCommand = require('../../structures/commands/SlashCommand');
// const logger = require('../../functions/logger');


module.exports = class ConfigCommand extends SlashCommand {
	constructor(data) {
		super(data, {
			aliases: [],
			description: 'show and edit the bot\'s config',
			options: [{
				name: 'edit',
				type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
				description: 'edit the config key with the provided value',
				options: [{
					name: 'key',
					type: Constants.ApplicationCommandOptionTypes.STRING,
					description: 'new / existing config key',
					required: true,
				}, {
					name: 'value',
					type: Constants.ApplicationCommandOptionTypes.STRING,
					description: 'new config value',
					required: true,
				}],
			}, {
				name: 'delete',
				type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
				description: 'delete the config key',
				options: [{
					name: 'key',
					type: Constants.ApplicationCommandOptionTypes.STRING,
					description: 'new / existing config key',
					required: true,
				}],
			}, {
				name: 'search',
				type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
				description: 'searches the config keys and values',
				options: [{
					name: 'query',
					type: Constants.ApplicationCommandOptionTypes.STRING,
					description: 'search query',
					required: false,
				}],
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
		// destructure subcommand
		const { name, options } = interaction.options.first();

		switch (name) {
			case 'edit': {
				const KEY = options.get('key').value.toUpperCase();
				const OLD_VALUE = this.config.get(KEY);
				const { key, value } = await this.config.set(KEY, options.get('value').value);

				return interaction.reply({
					content: `${key}: ${OLD_VALUE !== null ? `'${OLD_VALUE}' -> ` : ''}'${value}'`,
					code: 'apache',
				});
			}

			case 'delete': {
				const KEY = options.get('key').value.toUpperCase();
				const VALUE = this.config.get(KEY);

				if (VALUE === null) return interaction.reply(`\`${KEY}\` is not in the config`);

				await this.config.remove(KEY);
				return interaction.reply(`removed \`${KEY}\`: \`${VALUE}\``);
			}

			case 'search': {
				const query = options?.get('query')?.value;

				if (!query) return interaction.reply({
					content: this.config.cache
						.sorted(({ key: keyA }, { key: keyB }) => keyA.localeCompare(keyB))
						.map(({ key, value }) => `${key}: ${value}`)
						.join('\n'),
					code: 'apache',
					split: { char: '\n' },
				});

				const queryRegex = new RegExp(query, 'i');

				return interaction.reply({
					content: this.config.cache
						.filter(({ key, value }) => queryRegex.test(key) || queryRegex.test(value))
						.sorted(({ key: keyA }, { key: keyB }) => keyA.localeCompare(keyB))
						.map(({ key, value }) => `${key}: ${value}`)
						.join('\n')
						|| `no config entries for '${query}' found`,
					code: 'apache',
					split: { char: '\n' },
				});
			}

			default:
				throw new Error(`unknown subcommand '${name}'`);
		}
	}
};
