'use strict';

const { basename } = require('path');
const { Structures, CommandInteraction, Permissions } = require('discord.js');
const logger = require('../../functions/logger');


class LunarCommandInteraction extends CommandInteraction {
	constructor(...args) {
		super(...args);

		/**
		 * wether the first reply was ephemeral
		 */
		this.ephemeral = null;
		/**
		 * deferring promise
		 */
		this._deferring = null;

		const { channel } = this;

		/**
		 * wether to use ephemeral replies and deferring
		 */
		this.useEphemeral = channel !== null && channel.type !== 'dm'
			? !(channel.name.includes('command') || channel.isTicket || !(this.options.get('ephemeral')?.value ?? true)) // guild channel
			: false; // DM channel
	}

	/**
	 * @param {import('discord.js').ApplicationCommandOptionData} option
	 */
	static isSubCommandOption(option) {
		return (option?.type === 'SUB_COMMAND' || option.type === 'SUB_COMMAND_GROUP') ?? false;
	}

	/**
	 * @param {import('discord.js').CommandInteractionOption[]} options
	 */
	static stringifyOptions(options) {
		return options
			?.reduce(
				(acc, cur) => {
					if (LunarCommandInteraction.isSubCommandOption(cur)) {
						return `${acc} ${cur.name}${this.stringifyOptions(cur.options)}`;
					}

					return `${acc} ${cur.name}: ${cur.value}`;
				},
				'',
			)
			?? '';
	}

	get logInfo() {
		return `${this.commandName}${LunarCommandInteraction.stringifyOptions(this.options)}`;
	}

	/**
	 * the user who started the interaction (for compatibility with message methods)
	 */
	get author() {
		return this.user;
	}

	/**
	 * appends the first option name if the command is a sub command or sub command group
	 */
	get fullCommandName() {
		const firstOption = this.options?.first();
		return `${this.commandName}${LunarCommandInteraction.isSubCommandOption(firstOption) ? ` ${firstOption.name}` : ''}`;
	}

	/**
	 * @param {import('discord.js').InteractionDeferOptions} param0
	 */
	async defer({ ephemeral = this.useEphemeral, ...options } = {}) {
		this.ephemeral = ephemeral;

		return this._deferring = super.defer({ ephemeral, ...options });
	}

	/**
	 *
	 * @param {string | import('discord.js').InteractionReplyOptions} contentOrOptions
	 */
	async reply(contentOrOptions) {
		const data = typeof contentOrOptions === 'string'
			? { ephemeral: this.useEphemeral, content: contentOrOptions }
			: { ephemeral: this.useEphemeral, ...contentOrOptions };

		await this._deferring;

		if (this.deferred) {
			// ephemeral defer
			if (this.ephemeral) {
				if (data.ephemeral) return this.editReply(data);

				// ephemeral defer and non-ephemeral followUp
				await this.deleteReply();
				return this.followUp(data);
			}

			// non-ephemeral defer
			if (data.ephemeral) {
				await this.deleteReply();
				return this.followUp(data);
			}

			return this.editReply(data);
		}

		if (this.replied) return this.followUp(data);

		this.ephemeral = data.ephemeral;

		return super.reply(data);
	}

	/**
	 * posts question in same channel and returns content of first reply or null if timeout
	 * @param {string} question the question to ask the message author
	 * @param {number} timeoutSeconds secods before the question timeouts
	 */
	async awaitReply(question, timeoutSeconds = 60) {
		try {
			await this.reply(question);

			const collected = await this.channel.awaitMessages(
				msg => msg.author.id === this.user.id,
				{ max: 1, time: timeoutSeconds * 1_000, errors: [ 'time' ] },
			);

			return collected.first().content;
		} catch {
			return null;
		}
	}

	/**
	 * react in order if the message is not deleted and the client has 'ADD_REACTIONS', catching promise rejections
	 * @param {import('discord.js').EmojiIdentifierResolvable[]} emojis
	 * @returns {Promise<?import('discord.js').MessageReaction[]>}
	 */
	async react(...emojis) {
		if (this.ephemeral) return null;
		if (!this.channel?.botPermissions.has(Permissions.FLAGS.ADD_REACTIONS)) return null;

		try {
			return (await this.fetchReply()).react(...emojis);
		} catch (error) {
			return logger.error('[MESSAGE REACT]', error);
		}
	}
}

Structures.extend(basename(__filename, '.js'), () => LunarCommandInteraction);

module.exports = LunarCommandInteraction;
