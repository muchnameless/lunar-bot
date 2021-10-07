import { SlashCommandBooleanOption, SlashCommandBuilder } from '@discordjs/builders';
import { Formatters } from 'discord.js';
import { stripIndents } from 'common-tags';
import { basename } from 'node:path';
import { InteractionUtil } from '../../util';
import { logger, readJSFiles } from '../../functions';
import { DualCommand } from '../../structures/commands/DualCommand';
import type { CommandInteraction } from 'discord.js';
import type { CommandContext } from '../../structures/commands/BaseCommand';
import type { HypixelUserMessage } from '../../structures/chat_bridge/HypixelMessage';


export default class ReloadCommand extends DualCommand {
	constructor(context: CommandContext) {
		const reloadOption = new SlashCommandBooleanOption()
			.setName('reload')
			.setDescription('wether to reimport the file')
			.setRequired(false);
		const forceOption = new SlashCommandBooleanOption()
			.setName('force')
			.setDescription('wether to load disabled events')
			.setRequired(false);

		super(context, {
			aliases: [],
			slash: new SlashCommandBuilder()
				.setDescription('hot reload certain parts of the bot')
				.addSubcommand(subcommand => subcommand
					.setName('command')
					.setDescription('reload a command')
					.addStringOption(option => option
						.setName('name')
						.setDescription('command name')
						.setRequired(true),
					)
					.addBooleanOption(reloadOption),
				)
				.addSubcommand(subcommand => subcommand
					.setName('commands')
					.setDescription('reload all commands')
					.addBooleanOption(reloadOption),
				)
				.addSubcommand(subcommand => subcommand
					.setName('event')
					.setDescription('reload an event')
					.addStringOption(option => option
						.setName('name')
						.setDescription('event name')
						.setRequired(true),
					)
					.addBooleanOption(reloadOption)
					.addBooleanOption(forceOption),
				)
				.addSubcommand(subcommand => subcommand
					.setName('events')
					.setDescription('reload all events')
					.addBooleanOption(reloadOption)
					.addBooleanOption(forceOption),
				)
				.addSubcommand(subcommand => subcommand
					.setName('database')
					.setDescription('reload the database cache'),
				)
				.addSubcommand(subcommand => subcommand
					.setName('cooldowns')
					.setDescription('reset all cooldowns'),
				)
				.addSubcommand(subcommand => subcommand
					.setName('filter')
					.setDescription('reload the blocked words filter'),
				),
			cooldown: 0,
		}, {
			aliases: [],
			args: true,
			usage: '[`command` [command `name`]|`commands`|`event` [event `name`]|`events`|`database`|`cooldowns`]',
		});
	}

	/**
	 * execute the command
	 * @param subcommand
	 * @param input
	 * @param reload
	 * @param force
	 */
	async #run(subcommand: string, input: string | null, reload = false, force = false) {
		switch (subcommand) {
			case 'command': {
				let commandName = input!.toLowerCase();

				try {
					// try to find file with INPUT name
					let commandFile;

					for await (const dir of readJSFiles(this.collection.dirURL)) {
						if (dir.basename.slice(0, -'.js'.length).toLowerCase() !== commandName) continue;

						commandFile = dir.fullPath;
						break;
					}

					let command;

					// no file found
					if (!commandFile) {
						// try to autocorrect input
						command = this.collection.getByName(commandName);

						if (command) {
							commandName = command.name;

							for await (const dir of readJSFiles(this.collection.dirURL)) {
								if (dir.basename.slice(0, -'.js'.length).toLowerCase() !== commandName) continue;

								commandFile = dir.fullPath;
								break;
							}
						}

					// file with exact name match found
					} else {
						commandName = basename(commandFile, '.js').toLowerCase();
						command = this.collection.get(commandName); // try to find already loaded command
					}

					if (!commandFile) return `no command with the name or alias \`${input}\` found`;

					// command already loaded
					if (command) {
						command.unload();
						commandName = command.name;
					}

					await this.collection.loadFromFile(commandFile, { reload });

					logger.info(`command ${commandName} was reloaded successfully`);
					return `command \`${commandName}\` was reloaded successfully`;
				} catch (error) {
					logger.error(error, 'an error occurred while reloading');
					return {
						content: stripIndents`
							an error occurred while reloading \`${commandName}\`:
							${Formatters.codeBlock('xl', `${error}`)}
						`,
						ephemeral: true,
					};
				}
			}

			case 'commands': {
				try {
					await this.collection.unloadAll().loadAll({ reload });
					return `${this.collection.size} command${this.collection.size !== 1 ? 's' : ''} were reloaded successfully`;
				} catch (error) {
					logger.error(error, 'an error occurred while reloading all commands');
					return {
						content: stripIndents`
							an error occurred while reloading all commands:
							${Formatters.codeBlock('xl', `${error}`)}
						`,
						ephemeral: true,
					};
				}
			}

			case 'event': {
				let eventName = input!.toLowerCase();

				try {
					// try to find file with INPUT name
					let eventFile;

					for await (const dir of readJSFiles(this.client.events.dirURL)) {
						if (dir.basename.slice(0, -'.js'.length).toLowerCase() !== eventName) continue;

						eventFile = dir.fullPath;
						break;
					}

					if (!eventFile) return `no event with the name \`${eventName}\` found`; // no file found

					// file with exact name match found
					this.client.events.get(basename(eventFile, '.js'))?.unload(); // try to find already loaded event

					({ name: eventName } = await this.client.events.loadFromFile(eventFile, { force, reload }));

					logger.info(`event ${eventName} was reloaded successfully`);
					return `event \`${eventName}\` was reloaded successfully`;
				} catch (error) {
					logger.error(error, 'an error occurred while reloading');
					return {
						content: stripIndents`
							an error occurred while reloading \`${eventName}\`:
							${Formatters.codeBlock('xl', `${error}`)}
						`,
						ephemeral: true,
					};
				}
			}

			case 'events': {
				try {
					await this.client.events.unloadAll().loadAll({ reload, force });
					return `${this.client.events.size} event${this.client.events.size !== 1 ? 's' : ''} were reloaded successfully`;
				} catch (error) {
					logger.error(error, 'an error occurred while reloading all events');
					return {
						content: stripIndents`
							an error occurred while reloading all events:
							${Formatters.codeBlock('xl', `${error}`)}
						`,
						ephemeral: true,
					};
				}
			}

			case 'database': {
				await this.client.db.loadCache();
				return 'database cache reloaded successfully';
			}

			case 'cooldowns': {
				this.collection.clearCooldowns();
				return 'cooldowns reset successfully';
			}

			case 'filter': {
				try {
					const { BLOCKED_WORDS_REGEXP } = await import(`../../structures/chat_bridge/constants/blockedWords.js?update=${Date.now()}`);
					const { ChatManager } = await import('../../structures/chat_bridge/managers/ChatManager.js');

					ChatManager.BLOCKED_WORDS_REGEXP = BLOCKED_WORDS_REGEXP;

					return 'filter reloaded successfully';
				} catch (error) {
					logger.error(error, 'an error occurred while reloading the filter');
					return {
						content: stripIndents`
							an error occurred while reloading the filter:
							${Formatters.codeBlock('xl', `${error}`)}
						`,
						ephemeral: true,
					};
				}
			}

			default:
				throw new Error(`unknown subcommand '${subcommand}'`);
		}
	}

	/**
	 * execute the command
	 * @param interaction
	 */
	override async runSlash(interaction: CommandInteraction) {
		return InteractionUtil.reply(interaction, await this.#run(interaction.options.getSubcommand(),
			interaction.options.getString('name'),
			interaction.options.getBoolean('reload') ?? false,
			interaction.options.getBoolean('force') ?? false,
		));
	}

	/**
	 * execute the command
	 * @param hypixelMessage
	 */
	override async runMinecraft(hypixelMessage: HypixelUserMessage) {
		return hypixelMessage.reply(await this.#run(hypixelMessage.commandData.args[0], hypixelMessage.commandData.args[1]));
	}
}
