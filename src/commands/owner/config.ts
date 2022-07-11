import { SlashCommandBuilder } from 'discord.js';
import { Type } from '@sapphire/type';
import { AutoCompleteLimits } from '@sapphire/discord-utilities';
import RE2 from 're2';
import { InteractionUtil } from '#utils';
import { ApplicationCommand } from '#structures/commands/ApplicationCommand';
import { formatNumber, sortCache } from '#functions';
import type { AutocompleteInteraction, Collection, ChatInputCommandInteraction } from 'discord.js';
import type { CommandContext } from '#structures/commands/BaseCommand';
import type { Config } from '#structures/database/models/Config';

export default class ConfigCommand extends ApplicationCommand {
	constructor(context: CommandContext) {
		super(context, {
			slash: new SlashCommandBuilder()
				.setDescription("show and edit the bot's config")
				.addSubcommand((subcommand) =>
					subcommand
						.setName('edit')
						.setDescription('edit the config key with the provided value')
						.addStringOption((option) =>
							option //
								.setName('key')
								.setDescription('new / existing config key')
								.setRequired(true)
								.setAutocomplete(true),
						)
						.addStringOption((option) =>
							option //
								.setName('value')
								.setDescription('new config value')
								.setRequired(true),
						)
						.addStringOption((option) =>
							option
								.setName('type')
								.setDescription('new config value type')
								.setRequired(false)
								.addChoices(...['string', 'number', 'boolean', 'array'].map((x) => ({ name: x, value: x }))),
						),
				)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('delete')
						.setDescription('delete the config key')
						.addStringOption((option) =>
							option //
								.setName('key')
								.setDescription('existing config key')
								.setRequired(true)
								.setAutocomplete(true),
						),
				)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('search')
						.setDescription('searches the config keys and values')
						.addStringOption((option) =>
							option //
								.setName('query')
								.setDescription('search query')
								.setRequired(false)
								.setAutocomplete(true),
						),
				),
			cooldown: 0,
		});
	}

	/**
	 * uppercased and (consecutive) spaces replaces with underscores
	 * @param key
	 */
	private static _transformKey(key: string) {
		return key.toUpperCase().replace(/ +/g, '');
	}

	/**
	 * @param entries
	 */
	private static _listEntries(entries: Collection<string, Config>) {
		return (
			entries
				.sorted(({ key: keyA }, { key: keyB }) => keyA.localeCompare(keyB))
				.map(
					({ key, parsedValue }) =>
						`${key}: ${
							typeof parsedValue === 'number' ? formatNumber(parsedValue).replace(/\s/g, '_') : parsedValue
						} [${new Type(parsedValue)}]`,
				)
				.join('\n') || '\u200B'
		);
	}

	/**
	 * @param interaction
	 * @param value input value
	 */
	override autocompleteRun(interaction: AutocompleteInteraction<'cachedOrDM'>, value: string) {
		if (!value) {
			return interaction.respond(
				this.config.cache
					.map(({ key }) => ({ name: key, value: key }))
					.slice(0, AutoCompleteLimits.MaximumAmountOfOptions),
			);
		}

		switch (interaction.options.getSubcommand()) {
			case 'edit':
			case 'search':
				return interaction.respond([
					{ name: value, value }, // current input
					...sortCache(
						this.config.cache,
						ConfigCommand._transformKey(value),
						'key',
						'key',
						AutoCompleteLimits.MaximumAmountOfOptions - 1,
					),
				]);

			case 'delete':
				return interaction.respond(sortCache(this.config.cache, ConfigCommand._transformKey(value), 'key', 'key'));

			default:
				throw new Error(`unknown subcommand '${interaction.options.getSubcommand()}'`);
		}
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		switch (interaction.options.getSubcommand()) {
			case 'edit': {
				const KEY = ConfigCommand._transformKey(interaction.options.getString('key', true));
				const OLD_VALUE = this.config.get(KEY);
				const OLD_TYPE = typeof OLD_VALUE;

				let newValue: string | number | boolean | string[] = interaction.options.getString('value', true);

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

				if (OLD_VALUE !== null && typeof newValue !== OLD_TYPE) {
					await InteractionUtil.awaitConfirmation(
						interaction,
						`type change from ${OLD_VALUE} (${new Type(OLD_VALUE)}) to ${newValue} (${new Type(newValue)}). Confirm?`,
					);
				}

				const { key, parsedValue } = await this.config.set(KEY, newValue);

				return InteractionUtil.reply(interaction, {
					content: `${key}: ${OLD_VALUE !== null ? `'${OLD_VALUE}' -> ` : ''}'${parsedValue}'`,
					code: 'apache',
				});
			}

			case 'delete': {
				const KEY = ConfigCommand._transformKey(interaction.options.getString('key', true));

				if (!this.config.cache.has(KEY)) return InteractionUtil.reply(interaction, `\`${KEY}\` is not in the config`);

				const VALUE = this.config.get(KEY);

				await this.config.destroy(KEY);
				return InteractionUtil.reply(interaction, `removed \`${KEY}\`: \`${VALUE}\``);
			}

			case 'search': {
				const query = interaction.options.getString('query')?.replace(/ +/g, '_');

				if (!query) {
					return InteractionUtil.reply(interaction, {
						content: ConfigCommand._listEntries(this.config.cache),
						code: 'apache',
						split: { char: '\n' },
					});
				}

				const queryRegex = new RE2(query, 'i');

				return InteractionUtil.reply(interaction, {
					content: ConfigCommand._listEntries(
						this.config.cache.filter(
							({ key, value }) => queryRegex.test(key) || (value !== null && queryRegex.test(value)),
						),
					),
					code: 'apache',
					split: { char: '\n' },
				});
			}

			default:
				throw new Error(`unknown subcommand '${interaction.options.getSubcommand()}'`);
		}
	}
}
