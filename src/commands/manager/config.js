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
				}, {
					name: 'type',
					type: Constants.ApplicationCommandOptionTypes.STRING,
					description: 'new config value type',
					required: false,
					choices: [ 'string', 'number', 'boolean', 'array' ].map(x => ({ name: x, value: x })),
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
			cooldown: 0,
		});
	}

	/**
	 * @param {import('discord.js').Collection} entries
	 */
	_listEntries(entries) {
		return entries.sorted(({ key: keyA }, { key: keyB }) => keyA.localeCompare(keyB))
			.map(({ key, parsedValue }) => {
				const type = typeof parsedValue;
				return `${key}: ${type === 'number' ? this.client.formatNumber(parsedValue).replace(/\s/g, '_') : parsedValue} [${Array.isArray(parsedValue) ? 'array' : type}]`;
			})
			.join('\n')
			|| '\u200b';
	}

	/**
	 * execute the command
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async run(interaction) {
		switch (interaction.options.getSubcommand()) {
			case 'edit': {
				const KEY = interaction.options.getString('key', true)
					.toUpperCase()
					.replace(/ +/g, '_');
				const OLD_VALUE = this.config.get(KEY);
				const OLD_TYPE = typeof OLD_VALUE;

				let newValue = interaction.options.getString('value', true);

				switch (interaction.options.getString('type')?.toLowerCase() ?? OLD_TYPE) {
					case 'number':
						newValue = Number(newValue.replaceAll('_', ''));
						break;

					case 'boolean':
						newValue = newValue === 'true';
						break;

					case 'array':
						newValue = newValue.split(',');
						break;
				}

				if (typeof newValue !== OLD_TYPE) {
					await this.awaitConfirmation(interaction, `type change from ${OLD_VALUE} (${OLD_TYPE}) to ${newValue} (${typeof newValue}). Confirm?`);
				}

				const { key, parsedValue } = await this.config.set(KEY, newValue);

				return await this.reply(interaction, {
					content: `${key}: ${OLD_VALUE !== null ? `'${OLD_VALUE}' -> ` : ''}'${parsedValue}'`,
					code: 'apache',
				});
			}

			case 'delete': {
				const KEY = interaction.options.getString('key', true)
					.toUpperCase()
					.replace(/ +/g, '_');
				const VALUE = this.config.get(KEY);

				if (VALUE === null) return await this.reply(interaction, `\`${KEY}\` is not in the config`);

				await this.config.remove(KEY);
				return await this.reply(interaction, `removed \`${KEY}\`: \`${VALUE}\``);
			}

			case 'search': {
				const query = interaction.options.getString('query')?.replace(/ +/g, '_');

				if (!query) return await this.reply(interaction, {
					content: this._listEntries(this.config.cache),
					code: 'apache',
					split: { char: '\n' },
				});

				const queryRegex = new RegExp(query, 'i');

				return await this.reply(interaction, {
					content: this._listEntries(this.config.cache.filter(({ key, value }) => queryRegex.test(key) || queryRegex.test(value))),
					code: 'apache',
					split: { char: '\n' },
				});
			}

			default:
				throw new Error(`unknown subcommand '${interaction.options.getSubcommand()}'`);
		}
	}
};
