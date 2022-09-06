import { basename } from 'node:path';
import { stripIndents } from 'common-tags';
import {
	codeBlock,
	SlashCommandBooleanOption,
	SlashCommandBuilder,
	type ChatInputCommandInteraction,
} from 'discord.js';
import { ChatManager } from '#chatBridge/managers/ChatManager.js';
import { readJSFiles } from '#functions';
import { logger } from '#logger';
import { ApplicationCommand } from '#structures/commands/ApplicationCommand.js';
import { type CommandContext } from '#structures/commands/BaseCommand.js';
import { type CommandType } from '#structures/commands/BaseCommandCollection.js';
import { InteractionUtil } from '#utils';

export default class ReloadCommand extends ApplicationCommand {
	public constructor(context: CommandContext) {
		const reloadOption = new SlashCommandBooleanOption()
			.setName('reload')
			.setDescription('whether to re-import the file')
			.setRequired(false);
		const forceOption = new SlashCommandBooleanOption()
			.setName('force')
			.setDescription('whether to load disabled events')
			.setRequired(false);

		super(context, {
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
				.addSubcommandGroup((subcommandGroup) =>
					subcommandGroup
						.setName('filter')
						.setDescription('reload the blocked words filter')
						.addSubcommand((subcommand) =>
							subcommand //
								.setName('blocked-words')
								.setDescription('reload the blocked words filter'),
						)
						.addSubcommand((subcommand) =>
							subcommand //
								.setName('allowed-urls')
								.setDescription('reload the allowed urls filter'),
						),
				),
			cooldown: 0,
		});
	}

	/**
	 * execute the command
	 *
	 * @param interaction
	 */
	public override async chatInputRun(interaction: ChatInputCommandInteraction<'cachedOrDM'>) {
		const subcommandGroup = interaction.options.getSubcommandGroup();
		const subcommand = interaction.options.getSubcommand();
		const reload = interaction.options.getBoolean('reload') ?? true;
		const force = interaction.options.getBoolean('force') ?? true;

		switch (subcommandGroup) {
			case 'filter': {
				let fileName;
				let propertyName;

				switch (subcommand) {
					case 'blocked-words':
						fileName = 'blockedExpressions.js' as const;
						propertyName = 'BLOCKED_EXPRESSIONS_REGEXP' as const;
						break;

					case 'allowed-urls':
						fileName = 'allowedURLs.js' as const;
						propertyName = 'ALLOWED_URLS_REGEXP' as const;
						break;

					default:
						throw new Error(`unknown subcommand '${subcommand}'`);
				}

				try {
					await ChatManager.reloadFilter(fileName, propertyName);

					return InteractionUtil.reply(interaction, `${subcommand}-filter reloaded successfully`);
				} catch (error) {
					logger.error(
						{ err: error, subcommand, fileName, propertyName },
						'an error occurred while reloading the filter',
					);

					throw stripIndents`
						an error occurred while reloading the ${subcommand}-filter:
						${codeBlock('xl', `${error}`)}
					`;
				}
			}

			case null:
				switch (subcommand) {
					case 'command': {
						let commandName = interaction.options.getString('name', true).toLowerCase();

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
							if (commandFile) {
								// file with exact name match found
								commandName = basename(commandFile, '.js').toLowerCase();
								command = this.collection.get(commandName); // try to find already loaded command
							} else {
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
							}

							if (!commandFile) {
								return InteractionUtil.reply(interaction, `no command with the name or alias \`${commandName}\` found`);
							}

							// command already loaded
							if (command) {
								command.unload();
								commandName = command.name;
							}

							await this.collection.loadFromFile(commandFile, { reload });

							logger.info(`command ${commandName} was reloaded successfully`);

							return InteractionUtil.reply(interaction, `command \`${commandName}\` was reloaded successfully`);
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

							return InteractionUtil.reply(
								interaction,
								`${this.collection.size} command${this.collection.size === 1 ? '' : 's'} were reloaded successfully`,
							);
						} catch (error) {
							logger.error(error, 'an error occurred while reloading all commands');

							throw stripIndents`
								an error occurred while reloading all commands:
								${codeBlock('xl', `${error}`)}
							`;
						}
					}

					case 'event': {
						let eventName = interaction.options.getString('name', true).toLowerCase();

						try {
							// try to find file with INPUT name
							let eventFile: string | undefined;

							for await (const path of readJSFiles(this.client.events.dirURL)) {
								if (basename(path, '.js').toLowerCase() !== eventName) continue;

								eventFile = path;
								break;
							}

							// no file found
							if (!eventFile) {
								return InteractionUtil.reply(interaction, `no event with the name \`${eventName}\` found`);
							}

							// file with exact name match found
							this.client.events.get(basename(eventFile, '.js'))?.unload(); // try to find already loaded event

							({ name: eventName } = await this.client.events.loadFromFile(eventFile, { force, reload }));

							logger.info(`event ${eventName} was reloaded successfully`);

							return InteractionUtil.reply(interaction, `event \`${eventName}\` was reloaded successfully`);
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

							return InteractionUtil.reply(
								interaction,
								`${this.client.events.size} event${
									this.client.events.size === 1 ? '' : 's'
								} were reloaded successfully`,
							);
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

						return InteractionUtil.reply(interaction, 'database cache reloaded successfully');
					}

					case 'cooldowns': {
						this.client.commands.clearCooldowns();
						this.client.chatBridges.commands.clearCooldowns();

						return InteractionUtil.reply(interaction, 'cooldowns reset successfully');
					}

					default:
						throw new Error(`unknown subcommand '${subcommand}'`);
				}

			default:
				throw new Error(`unknown subcommand gropu '${subcommandGroup}'`);
		}
	}
}
