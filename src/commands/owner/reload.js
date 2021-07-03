'use strict';

const { Constants } = require('discord.js');
const { stripIndents } = require('common-tags');
const { basename } = require('path');
const { getAllJsFiles } = require('../../functions/files');
const DualCommand = require('../../structures/commands/DualCommand');
const logger = require('../../functions/logger');


module.exports = class ReloadCommand extends DualCommand {
	constructor(data) {
		super(
			data,
			{
				aliases: [],
				description: 'reload certain parts of the bot',
				options: [{
					name: 'command',
					type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
					description: 'reload a command',
					options: [{
						name: 'name',
						type: Constants.ApplicationCommandOptionTypes.STRING,
						description: 'command name',
						required: true,
					}],
				}, {
					name: 'commands',
					type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
					description: 'reload all commands',
					options: [],
				}, {
					name: 'event',
					type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
					description: 'reload an event',
					options: [{
						name: 'name',
						type: Constants.ApplicationCommandOptionTypes.STRING,
						description: 'event name',
						required: true,
					}],
				}, {
					name: 'events',
					type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
					description: 'reload all events',
					options: [],
				}, {
					name: 'database',
					type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
					description: 'reload the database cache',
					options: [],
				}, {
					name: 'cooldowns',
					type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
					description: 'reset all cooldowns',
					options: [],
				}, {
					name: 'filter',
					type: Constants.ApplicationCommandOptionTypes.SUB_COMMAND,
					description: 'reload the blocked words filter',
					options: [],
				}],
				defaultPermission: true,
				cooldown: 0,
			},
			{
				aliases: [],
				args: true,
				usage: '[`command` [command `name`]|`commands`|`event` [event `name`]|`events`|`database`|`cooldowns`]',
			},
		);
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction') | import('../../structures/chat_bridge/HypixelMessage')} ctx
	 * @param {string} mode
	 * @param {string} name
	 */
	async _run(ctx, mode, name) { // eslint-disable-line no-unused-vars
		switch (mode) {
			case 'command': {
				let commandName = name.toLowerCase();

				try {
					const commandFiles = await getAllJsFiles(this.collection.dirPath);

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

					if (!commandFile) return ctx.reply(`no command with the name or alias \`${name}\` found`);

					// command already loaded
					if (command) {
						command.unload();
						commandName = command.name;
					}

					this.collection.loadFromFile(commandFile);

					logger.info(`command ${commandName} was reloaded successfully`);
					return ctx.reply(`command \`${commandName}\` was reloaded successfully`);
				} catch (error) {
					logger.error('An error occurred while reloading:\n', error);
					return ctx.reply(stripIndents`
						an error occurred while reloading \`${commandName}\`:
						\`\`\`xl
						${error}
						\`\`\`
					`);
				}
			}

			case 'commands': {
				await this.collection.unloadAll().loadAll();
				return ctx.reply(`${this.collection.size} command${this.collection.size !== 1 ? 's' : ''} were reloaded successfully`);
			}

			case 'event': {
				let eventName = name.toLowerCase();

				try {
					const eventFiles = await getAllJsFiles(this.client.events.dirPath);
					const eventFile = eventFiles.find(file => basename(file, '.js').toLowerCase() === eventName); // try to find file with INPUT name

					if (!eventFile) return ctx.reply(`no event with the name \`${eventName}\` found`); // no file found

					// file with exact name match found
					this.client.events.get(basename(eventFile, '.js').toLowerCase())?.unload(); // try to find already loaded event

					({ name: eventName } = this.client.events.loadFromFile(eventFile, true));

					logger.info(`event ${eventName} was reloaded successfully`);
					return ctx.reply(`event \`${eventName}\` was reloaded successfully`);
				} catch (error) {
					logger.error('An error occurred while reloading:\n', error);
					return ctx.reply(stripIndents`
						an error occurred while reloading \`${eventName}\`:
						\`\`\`xl
						${error}
						\`\`\`
					`);
				}
			}

			case 'events': {
				await this.client.events.unloadAll().loadAll();
				return ctx.reply(`${this.client.events.size} event${this.client.events.size !== 1 ? 's' : ''} were reloaded successfully`);
			}

			case 'database': {
				await this.client.db.loadCache();
				return ctx.reply('database cache reloaded successfully');
			}

			case 'cooldowns': {
				this.collection.clearCooldowns();
				return ctx.reply('cooldowns reset successfully');
			}

			case 'filter': {
				delete require.cache[require.resolve('../../structures/chat_bridge/constants/chatBridge')];

				const { blockedWordsRegExp } = require('../../structures/chat_bridge/constants/chatBridge');
				const ChatManager = require('../../structures/chat_bridge/managers/ChatManager');

				ChatManager.BLOCKED_WORDS_REGEXP = blockedWordsRegExp;

				return ctx.reply('filter reloaded successfully');
			}

			default:
				throw new Error(`unknown subcommand '${mode}'`);
		}
	}

	/**
	 * execute the command
	 * @param {import('../../structures/extensions/CommandInteraction')} interaction
	 */
	async run(interaction) {
		// destructure subcommand
		const { name, options } = interaction.options.first();

		return this._run(interaction, name, options?.get('name').value);
	}

	/**
	 * execute the command
	 * @param {import('../../structures/chat_bridge/HypixelMessage')} message message that triggered the command
	 * @param {string[]} args command arguments
	 */
	async runInGame(message, args) { // eslint-disable-line no-unused-vars
		return this._run(message, ...args);
	}
};
