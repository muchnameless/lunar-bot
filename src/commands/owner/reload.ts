import { basename } from 'node:path';
import { codeBlock, SlashCommandBooleanOption, SlashCommandBuilder } from 'discord.js';
import { stripIndents } from 'common-tags';
import { InteractionUtil } from '../../util';
import { readJSFiles } from '../../functions';
import { DualCommand } from '../../structures/commands/DualCommand';
import { logger } from '../../logger';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandType } from '../../structures/commands/BaseCommandCollection';
import type { CommandContext } from '../../structures/commands/BaseCommand';
import type { HypixelUserMessage } from '../../structures/chat_bridge/HypixelMessage';

export default class ReloadCommand extends DualCommand {
	constructor(context: CommandContext) {
		const reloadOption = new SlashCommandBooleanOption()
			.setName('reload')
			.setDescription('whether to re-import the file')
			.setRequired(false);
		const forceOption = new SlashCommandBooleanOption()
			.setName('force')
			.setDescription('whether to load disabled events')
			.setRequired(false);

		super(
			context,
			{
				slash: new SlashCommandBuilder()
					.setDescription('hot reload certain parts of the bot')
					.addSubcommand((subcommand) =>
						subcommand
							.setName('command')
							.setDescription('reload a command')
							.addStringOption((option) =>
								option //
									.setName('name')
									.setDescription('command name')
									.setRequired(true),
							)
							.addBooleanOption(reloadOption),
					)
					.addSubcommand((subcommand) =>
						subcommand //
							.setName('commands')
							.setDescription('reload all commands')
							.addBooleanOption(reloadOption),
					)
					.addSubcommand((subcommand) =>
						subcommand
							.setName('event')
							.setDescription('reload an event')
							.addStringOption((option) =>
								option //
									.setName('name')
									.setDescription('event name')
									.setRequired(true),
							)
							.addBooleanOption(reloadOption)
							.addBooleanOption(forceOption),
					)
					.addSubcommand((subcommand) =>
						subcommand
							.setName('events')
							.setDescription('reload all events')
							.addBooleanOption(reloadOption)
							.addBooleanOption(forceOption),
					)
					.addSubcommand((subcommand) =>
						subcommand //
							.setName('database')
							.setDescription('reload the database cache'),
					)
					.addSubcommand((subcommand) =>
						subcommand //
							.setName('cooldowns')
							.setDescription('reset all cooldowns'),
					)
					.addSubcommand((subcommand) =>
						subcommand //
							.setName('filter')
							.setDescription('reload the blocked words filter'),
					),
				cooldown: 0,
			},
			{
				args: 2,
				usage: '[`command` [command `name`]|`commands`|`event` [event `name`]|`events`|`database`|`cooldowns`]',
			},
		);
	}

	/**
	 * execute the command
	 * @param subcommand
	 * @param input
	 * @param reload
	 * @param force
	 */
	private async _sharedRun(subcommand: string, input: string | null, reload = true, force = true) {
		switch (subcommand) {
			case 'command': {
				let commandName = input!.toLowerCase();

				try {
					// try to find file with INPUT name
					let commandFile: string | undefined;

					for await (const path of readJSFiles(this.collection.dirURL)) {
						if (basename(path, '.js').toLowerCase() !== commandName) continue;

						commandFile = path;
						break;
					}

					let command: CommandType | null | undefined;

					// no file found
					if (!commandFile) {
						// try to autocorrect input
						command = this.collection.getByName(commandName);

						if (command) {
							commandName = command.name;

							for await (const path of readJSFiles(this.collection.dirURL)) {
								if (basename(path, '.js').toLowerCase() !== commandName) continue;

								commandFile = path;
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

					throw stripIndents`
						an error occurred while reloading \`${commandName}\`:
						${codeBlock('xl', `${error}`)}
					`;
				}
			}

			case 'commands': {
				try {
					await this.collection.unloadAll().loadAll({ reload });

					return `${this.collection.size} command${this.collection.size !== 1 ? 's' : ''} were reloaded successfully`;
				} catch (error) {
					logger.error(error, 'an error occurred while reloading all commands');

					throw stripIndents`
						an error occurred while reloading all commands:
						${codeBlock('xl', `${error}`)}
					`;
				}
			}

			case 'event': {
				let eventName = input!.toLowerCase();

				try {
					// try to find file with INPUT name
					let eventFile: string | undefined;

					for await (const path of readJSFiles(this.client.events.dirURL)) {
						if (basename(path, '.js').toLowerCase() !== eventName) continue;

						eventFile = path;
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

					throw stripIndents`
						an error occurred while reloading \`${eventName}\`:
						${codeBlock('xl', `${error}`)}
					`;
				}
			}

			case 'events': {
				try {
					await this.client.events.unloadAll().loadAll({ reload, force });

					return `${this.client.events.size} event${
						this.client.events.size !== 1 ? 's' : ''
					} were reloaded successfully`;
				} catch (error) {
					logger.error(error, 'an error occurred while reloading all events');

					throw stripIndents`
						an error occurred while reloading all events:
						${codeBlock('xl', `${error}`)}
					`;
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
					const { BLOCKED_WORDS_REGEXP } = await import(
						`../../structures/chat_bridge/constants/blockedWords.js?update=${Date.now()}`
					);
					const { ChatManager } = await import('../../structures/chat_bridge/managers/ChatManager');

					ChatManager.BLOCKED_WORDS_REGEXP = BLOCKED_WORDS_REGEXP;

					return 'filter reloaded successfully';
				} catch (error) {
					logger.error(error, 'an error occurred while reloading the filter');

					throw stripIndents`
						an error occurred while reloading the filter:
						${codeBlock('xl', `${error}`)}
					`;
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
	override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		return InteractionUtil.reply(
			interaction,
			await this._sharedRun(
				interaction.options.getSubcommand(),
				interaction.options.getString('name'),
				interaction.options.getBoolean('reload') ?? undefined,
				interaction.options.getBoolean('force') ?? undefined,
			),
		);
	}

	/**
	 * execute the command
	 * @param hypixelMessage
	 */
	override async minecraftRun(hypixelMessage: HypixelUserMessage) {
		return hypixelMessage.reply(
			await this._sharedRun(hypixelMessage.commandData.args[0]!, hypixelMessage.commandData.args[1]!),
		);
	}
}
