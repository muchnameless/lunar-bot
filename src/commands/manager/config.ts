import { SlashCommandBuilder } from '@discordjs/builders';
import { Type } from '@sapphire/type';
import { InteractionUtil } from '../../util';
import { SlashCommand } from '../../structures/commands/SlashCommand';
import type { Collection, CommandInteraction } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';
import type { Config } from '../../structures/database/models/Config';


export default class ConfigCommand extends SlashCommand {
	constructor(context: CommandContext) {
		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('show and edit the bot\'s config')
				.addSubcommand(subcommand => subcommand
					.setName('edit')
					.setDescription('edit the config key with the provided value')
					.addStringOption(option => option
						.setName('key')
						.setDescription('new / existing config key')
						.setRequired(true),
					)
					.addStringOption(option => option
						.setName('value')
						.setDescription('new config value')
						.setRequired(true),
					)
					.addStringOption(option => option
						.setName('type')
						.setDescription('new config value type')
						.setRequired(false)
						.addChoices([ 'string', 'number', 'boolean', 'array' ].map(x => [ x, x ])),
					),
				)
				.addSubcommand(subcommand => subcommand
					.setName('delete')
					.setDescription('delete the config key')
					.addStringOption(option => option
						.setName('key')
						.setDescription('existing config key')
						.setRequired(true),
					),
				)
				.addSubcommand(subcommand => subcommand
					.setName('search')
					.setDescription('searches the config keys and values')
					.addStringOption(option => option
						.setName('query')
						.setDescription('search query')
						.setRequired(false),
					),
				),
			cooldown: 0,
		});
	}

	/**
	 * @param entries
	 */
	#listEntries(entries: Collection<string, Config>) {
		return entries.sorted(({ key: keyA }, { key: keyB }) => keyA.localeCompare(keyB))
			.map(({ key, parsedValue }) => `${key}: ${typeof parsedValue === 'number'
					? this.client.formatNumber(parsedValue).replace(/\s/g, '_')
					: parsedValue
				} [${new Type(parsedValue)}]`)
			.join('\n')
			|| '\u200B';
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async runSlash(interaction: CommandInteraction) {
		switch (interaction.options.getSubcommand()) {
			case 'edit': {
				const KEY = interaction.options.getString('key', true)
					.toUpperCase()
					.replace(/ +/g, '_');
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
				const KEY = interaction.options.getString('key', true)
					.toUpperCase()
					.replace(/ +/g, '_');
				const VALUE = this.config.get(KEY);

				if (VALUE === null) return InteractionUtil.reply(interaction, `\`${KEY}\` is not in the config`);

				await this.config.remove(KEY);
				return InteractionUtil.reply(interaction, `removed \`${KEY}\`: \`${VALUE}\``);
			}

			case 'search': {
				const query = interaction.options.getString('query')?.replace(/ +/g, '_');

				if (!query) return InteractionUtil.reply(interaction, {
					content: this.#listEntries(this.config.cache),
					code: 'apache',
					split: { char: '\n' },
				});

				const queryRegex = new RegExp(query, 'i');

				return InteractionUtil.reply(interaction, {
					content: this.#listEntries(this.config.cache.filter(({ key, value }) => queryRegex.test(key) || (value !== null && queryRegex.test(value)))),
					code: 'apache',
					split: { char: '\n' },
				});
			}

			default:
				throw new Error(`unknown subcommand '${interaction.options.getSubcommand()}'`);
		}
	}
}
