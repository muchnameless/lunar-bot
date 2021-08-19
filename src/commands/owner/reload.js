import { SlashCommandBooleanOption, SlashCommandBuilder } from '@discordjs/builders';
import { Formatters } from 'discord.js';
import { stripIndents } from 'common-tags';
import { basename } from 'path';
import { getAllJsFiles } from '../../functions/files.js';
import { InteractionUtil } from '../../util/InteractionUtil.js';
import { DualCommand } from '../../structures/commands/DualCommand.js';
import { logger } from '../../functions/logger.js';


export default class ReloadCommand extends DualCommand {
	constructor(context) {
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
	 * @param {string} subcommand
	 * @param {string} input
	 * @param {boolean} [reload=false]
	 * @param {boolean} [force=false]
	 */
	async #run(subcommand, input, reload = false, force = false) {
		switch (subcommand) {
			case 'command': {
				let commandName = input.toLowerCase();

				try {
					const commandFiles = await getAllJsFiles(this.collection.dirURL);

					// try to find file with INPUT name
					let commandFile = commandFiles.find(file => basename(file, '.js').toLowerCase() === commandName);
					/** @type {?import('../../structures/commands/BaseCommand')} */
					let command;

					// no file found
					if (!commandFile) {
						// try to autocorrect input
						command = this.collection.getByName(commandName);

						if (command) {
							commandName = command.name;
							commandFile = commandFiles.find(file => basename(file, '.js').toLowerCase() === commandName);
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

					await this.collection.loadFromFile(commandFile, { reload, force });

					logger.info(`command ${commandName} was reloaded successfully`);
					return `command \`${commandName}\` was reloaded successfully`;
				} catch (error) {
					logger.error('An error occurred while reloading', error);
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
					logger.error('An error occurred while reloading all commands', error);
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
				let eventName = input.toLowerCase();

				try {
					const eventFiles = await getAllJsFiles(this.client.events.dirURL);
					const eventFile = eventFiles.find(file => basename(file, '.js').toLowerCase() === eventName); // try to find file with INPUT name

					if (!eventFile) return `no event with the name \`${eventName}\` found`; // no file found

					// file with exact name match found
					this.client.events.get(basename(eventFile, '.js').toLowerCase())?.unload(); // try to find already loaded event

					({ name: eventName } = await this.client.events.loadFromFile(eventFile, { force, reload }));

					logger.info(`event ${eventName} was reloaded successfully`);
					return `event \`${eventName}\` was reloaded successfully`;
				} catch (error) {
					logger.error('An error occurred while reloading', error);
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
					logger.error('An error occurred while reloading all events', error);
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
					const { blockedWordsRegExp } = await import(`../../structures/chat_bridge/constants/blockedWords.js?update=${Date.now()}`);
					const { ChatManager } = await import('../../structures/chat_bridge/managers/ChatManager.js');

					ChatManager.BLOCKED_WORDS_REGEXP = blockedWordsRegExp;

					return 'filter reloaded successfully';
				} catch (error) {
					logger.error('An error occurred while reloading the filter', error);
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
	 * @param {import('discord.js').CommandInteraction} interaction
	 */
	async runSlash(interaction) {
		return await InteractionUtil.reply(interaction, await this.#run(interaction.options.getSubcommand(),
			interaction.options.getString('name'),
			interaction.options.getBoolean('reload') ?? false,
			interaction.options.getBoolean('force') ?? false,
		));
	}

	/**
	 * execute the command
	 * @param {import('../../structures/chat_bridge/HypixelMessage').HypixelMessage} hypixelMessage
	 */
	async runMinecraft(hypixelMessage) {
		return await hypixelMessage.reply(await this.#run(...hypixelMessage.commandData.args));
	}
}
