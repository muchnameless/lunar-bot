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
				name: 'key',
				type: Constants.ApplicationCommandOptionTypes.STRING,
				description: 'new / existing config key',
				required: false,
			}, {
				name: 'value',
				type: Constants.ApplicationCommandOptionTypes.STRING,
				description: 'new config value',
				required: false,
			}, {
				name: 'delete',
				type: Constants.ApplicationCommandOptionTypes.BOOLEAN,
				description: 'delete the selected key',
				required: false,
			}],
			defaultPermission: true,
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) { // eslint-disable-line no-unused-vars
		// list all config entries
		if (!interaction.options.size) {
			return interaction.reply({
				content: this.config.cache
					.sorted(({ key: keyA }, { key: keyB }) => keyA.localeCompare(keyB))
					.map(({ key, value }) => `${key}: ${value}`)
					.join('\n'),
				code: 'apache',
				split: { char: '\n' },
			});
		}

		const KEY = interaction.options.get('key')?.value.toUpperCase() ?? (() => { throw 'specifiy a config key to edit'; })();

		// search the config
		if (!interaction.options.has('value')) {
			// delete an existing entry
			if (interaction.options.get('delete')?.value) {
				const VALUE = this.config.get(KEY);

				if (VALUE === null) return interaction.reply(`\`${KEY}\` is not in the config`);

				await this.config.remove(KEY);
				return interaction.reply(`removed \`${KEY}\`: \`${VALUE}\``);
			}

			const queryRegex = new RegExp(KEY, 'i');

			return interaction.reply({
				content: this.config.cache
					.filter(({ key, value }) => queryRegex.test(key) || queryRegex.test(value))
					.sorted(({ key: keyA }, { key: keyB }) => keyA.localeCompare(keyB))
					.map(({ key, value }) => `${key}: ${value}`)
					.join('\n')
					|| `no config entries for '${KEY}' found`,
				code: 'apache',
				split: { char: '\n' },
			});
		}

		// set a config entry
		const OLD_VALUE = this.config.get(KEY);
		const { key, value } = await this.config.set(KEY, interaction.options.get('value').value);

		return interaction.reply({
			content: `${key}: ${OLD_VALUE !== null ? `'${OLD_VALUE}' -> ` : ''}'${value}'`,
			code: 'apache',
		});
	}
};
