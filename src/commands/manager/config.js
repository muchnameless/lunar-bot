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
			defaultPermission: true,
			// permissions: [{
			// 	id: data.client.config.get('DISCORD_GUILD_ID'),
			// 	type: Constants.ApplicationCommandPermissionTypes.ROLE,
			// 	permission: false,
			// }, {
			// 	id: data.client.config.get('MANAGER_ROLE_ID'),
			// 	type: Constants.ApplicationCommandPermissionTypes.ROLE,
			// 	permission: true,
			// }],
			cooldown: 0,
		});
	}

	/**
	 * @param {import('discord.js').Collection} entries
	 */
	listEntries(entries) {
		return entries.sorted(({ key: keyA }, { key: keyB }) => keyA.localeCompare(keyB))
			.map(({ key, parsedValue }) => {
				const type = typeof parsedValue;
				return `${key}: ${type === 'number' ? this.client.formatNumber(parsedValue).replace(/\s/g, '_') : parsedValue} [${Array.isArray(parsedValue) ? 'array' : type}]`;
			})
			.join('\n');
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
				const KEY = options.get('key').value.toUpperCase().replace(/ +/g, '_');
				const OLD_VALUE = this.config.get(KEY);

				let { value: newValue } = options.get('value');

				switch (options.get('type')?.value.toLowerCase()) {
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

				if (typeof newValue !== typeof OLD_VALUE) {
					await interaction.awaitConfirmation(`type change from ${OLD_VALUE} (${typeof OLD_VALUE}) to ${newValue} (${typeof newValue}). Confirm?`);
				}

				const { key, parsedValue } = await this.config.set(KEY, newValue);

				return interaction.reply({
					content: `${key}: ${OLD_VALUE !== null ? `'${OLD_VALUE}' -> ` : ''}'${parsedValue}'`,
					code: 'apache',
				});
			}

			case 'delete': {
				const KEY = options.get('key').value.toUpperCase().replace(/ +/g, '_');
				const VALUE = this.config.get(KEY);

				if (VALUE === null) return interaction.reply(`\`${KEY}\` is not in the config`);

				await this.config.remove(KEY);
				return interaction.reply(`removed \`${KEY}\`: \`${VALUE}\``);
			}

			case 'search': {
				const query = options?.get('query')?.value.replace(/ +/g, '_');

				if (!query) return interaction.reply({
					content: this.listEntries(this.config.cache),
					code: 'apache',
					split: { char: '\n' },
				});

				const queryRegex = new RegExp(query, 'i');

				return interaction.reply({
					content: this.listEntries(this.config.cache.filter(({ key, value }) => queryRegex.test(key) || queryRegex.test(value))),
					code: 'apache',
					split: { char: '\n' },
				});
			}

			default:
				throw new Error(`unknown subcommand '${name}'`);
		}
	}
};
